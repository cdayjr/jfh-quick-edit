/*  
 * Quick edit add-on for InvisionFree-powered forums
 * Version 3.1.0
 *
 * (c) 2006 Albert Pham
 * 
 * This file is licensed under WTFPL - http://www.wtfpl.net/
*/

SKIFS.quickEdit =
{
    // script configuration
    config:
    {
        // the quick edit button
        button: '<img src="http://img62.imageshack.us/img62/7386/quickedit5ft.png" alt="Quick Edit" /> ',
        // some other scripts modify which TD cell we need
        postCellCount: 3,
        // should it append the edit note
        editHistoryEnabled: true,
        // add a quick edit button
        addQuickEditButton: true,
        // hide original edit buttons
        hideEditButtons: false,
        // allow invoking quick edit by double clicking
        // the post area; could get annoying
        enableDoubleClick: false
    },
    
    // when a post is chosen to be edited, the original HTML
    // in the TD is stored here so that we may restore it
    originalPostHtml: {},
    // stored icons
    postIcons: {},
    // auth key we need to do anything
    authKey: '',
    
    // call first
    construct: function(useCustomStyles)
    {
        // check if we can support quick edit in the browser
        if(!SKIFS.util.getAjax() ||
           !document.getElementById ||
           !document.body.innerHTML) return;
           
        if(!useCustomStyles)
        {
            document.write('<style type="text/css">'+
                           '.quick-edit { border: 3px solid #000000; padding: 4px }'+
                           '.quick-edit textarea { width: 100%; border: 1px solid #999999; padding: 5px; color: #000000; background: #FFFFFF; font-family: Verdana, sans-serif }'+
                           '.quick-edit .editor { margin-bottom: 3px; }'+
                           '.quick-edit .right-buttons input { width: 30px }'+
                           '.quick-edit .save { font-weight: bold }'+
                           '.quick-edit .full { margin-left: 20px }'+
                           '</style>');
        }
        
        var links = document.links;
        
        // loop through all links in the page
        for(var i in links)
        {
            if(!links[i].href) continue;
            
            var href = links[i].href;
            
            // add quick edit buttons after all post edit buttons
            // we don't need to check for security because the button wouldn't
            // be there if we couldn't edit
            if(href.match(/act=Post&CODE=08/))
            {
                var fid = href.match(/f=([0-9]+)/)[1];
                var tid = href.match(/t=([0-9]+)/)[1];
                var pid = href.match(/p=([0-9]+)/)[1];
                
                if(this.config.addQuickEditButton)
                {
                    var editButton = document.createElement('span');
                    editButton.innerHTML = '<a style="cursor:pointer" onclick="SKIFS.quickEdit.edit('+fid+','+tid+','+pid+')">'+this.config.button+'</a>';
                    links[i].parentNode.insertBefore(editButton, links[i].nextSibling);
                }
                
                if(this.config.hideEditButtons)
                    links[i].style.display = 'none';
                
                if(this.config.enableDoubleClick)
                {
                    var postE = this.getPostElement(pid);
                    postE.fid = fid;
                    postE.tid = tid;
                    postE.pid = pid;
                    postE.ondblclick = function()
                    {
                        SKIFS.quickEdit.edit(this.fid, this.tid, this.pid);
                    };
                }
            }
        }
    },
    // returns the TD element for the post we need
    // from a provided post ID
    getPostElement: function(pid)
    {
        var postAreaE = null;
        var anchors = document.anchors;
        
        // look for the element for the post we need
        for(var i in anchors)
        {
            if(anchors[i].getAttribute && anchors[i].getAttribute('name') == 'entry'+pid)
            {
                postAreaE = anchors[i];
                break;
            }
        }

        // need to get the TD that the post is currently in
        var postE = postAreaE.nextSibling;
        if(postE.nodeType != 1) postE = postE.nextSibling; // account for whitespace
        postE = postE.getElementsByTagName('td')[this.config.postCellCount];
        
        return postE;
    },
    // called when a post needs to be edited
    edit: function(fid, tid, pid)
    {
        // we are already ending this post; return
        if(this.originalPostHtml[pid]) return;
        
        var postE = this.getPostElement(pid);
        postE.id = "post-area-"+pid; // for later reference

        // store original HTML for later use
        this.originalPostHtml[pid] = postE.innerHTML;
        
        postE.innerHTML = '<form method="post" action="#" id="qe-form-'+pid+'">'+
                          '<div class="quick-edit"><div id="qe-editor-'+pid+'" class="editor"><textarea rows="10" cols="60" disabled="disabled" name="Post" style="height: 200px">Please wait as the post loads...</textarea></div>'+
                          '<div style="float:left" class="buttons"><input name="save" class="save" type="button" value="Save Changes" disabled="disabled" onclick="SKIFS.quickEdit.save('+fid+','+tid+','+pid+')" /> '+
                          '<input name="cancel" class="cancel" type="button" disabled="disabled" value="Cancel" onclick="if(confirm(\'Are you sure you wish to discard your changes?\'))SKIFS.quickEdit.discard('+pid+')" /> '+
                          '<input name="full" class="full" type="button" onclick="this.form.submit()" disabled="disabled" value="Full Edit &gt;&gt;" /></div>'+
                          '<div style="text-align:right" class="right-buttons"><input type="button" value="+" onclick="if(this.form.Post)this.form.Post.style.height=parseInt(this.form.Post.style.height)+100+\'px\'" /><input type="button" value="-" onclick="if(this.form.Post)this.form.Post.style.height=parseInt(this.form.Post.style.height)-100+\'px\'" /></div>'+
                          '</div></form>';

        // send a request to get the original code for the post
        var req = SKIFS.util.getAjax();
        req.open('GET', SKIFS.util.getBaseUrl()+'index.php?act=Post&CODE=08&f='+fid+'&t='+tid+'&p='+pid+'&s='+SKIFS.util.getSessionId(), true);
        req.onreadystatechange = function()
        {
            if(req.readyState == 4)
                SKIFS.quickEdit.update(fid, tid, pid, req.responseText);
        };
        req.send(null);
    },
    // called when the original post was deleted
    // from SKIFS.quickEdit.edit
    update: function(fid, tid, pid, response)
    {        
        var editorE = document.getElementById('qe-editor-'+pid);
        var formE = document.getElementById('qe-form-'+pid);
        
        // we need this to do updates
        // it is a key to prevent off-site attempts at doing things
        this.authKey = response.match(/auth_key' value='(.{32})'/)[1]; //'
        
        // to avoid HTML escaping issues, we just replace the form with the content
        var content = response.match(/<textarea cols='80' rows='20' name='Post' tabindex='3' class='textinput'>((.|\n)*)<\/textarea>/)[1];
        if(!content) content = response.match(/<textarea cols='80' rows='20' name='Post' tabindex='3' class='textinput'>(.*)<\/textarea>/)[1];
        editorE.innerHTML = '<textarea rows="10" cols="60" name="Post" style="height: 200px">'+content+'</textarea>';
        
        // store the post icon so we don't lose it when
        // we save
        this.postIcons[pid] = response.match(/name=('|")iconid('|") value=('|")([0-9]+)('|") checked/)[4]; //'
        
        with(formE)
        {
            Post.focus();
            save.disabled = false;
            cancel.disabled = false;
            full.disabled= false;
            action = window.location.href.replace(/index\..*$/,'')+'index.php?act=Post&CODE=08&f='+fid+'&t='+tid+'&p='+pid+'&editupload=keep&add_edit='+(this.config.editHistoryEnabled ? '1' : '0')+'&iconid='+this.postIcons[pid]+'&enableemo=yes&enablesig=yes&preview=1';
        }
    },
    // canceling a quick edit
    discard: function(pid)
    {
        var postE = document.getElementById('post-area-'+pid);
        postE.innerHTML = this.originalPostHtml[pid];
        this.originalPostHtml[pid] = null;
        this.postIcons[pid] = null;
    },
    // saves the edited post
    save: function(fid, tid, pid)
    {
        var formE = document.getElementById('qe-form-'+pid);
        
        if(formE.Post.value == '')
        {
            alert('You must enter a message to post!');
            return;
        }
        
        formE.Post.disabled = true;
        formE.cancel.disabled = true;
        formE.save.value = "Saving... please wait";
        
        // this is the pagination offset
        var st = window.location.href.match(/st=([0-9]+)/);
        st = st ? st[1] : 0;
        
        // save the post
        var req = SKIFS.util.getAjax();
        req.open('POST', SKIFS.util.getBaseUrl()+'index.php?act=Post&CODE=09&f='+fid+'&t='+tid+'&p='+pid+'&st='+st+'&auth_key='+this.authKey+'&s='+SKIFS.util.getSessionId(), true);
        req.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        req.onreadystatechange = function()
        {
            if(req.readyState == 4)
                SKIFS.quickEdit.finish(pid, req.responseText);
        };
        req.send('editupload=keep&add_edit='+(this.config.editHistoryEnabled ? '1' : '0')+'&iconid='+this.postIcons[pid]+'&enableemo=yes&enablesig=yes&Post='+SKIFS.util.utf8Decode(formE.Post.value));
    },
    // finish up after a save
    finish: function(pid, response)
    {
        var formE = document.getElementById('qe-form-'+pid);
        
        // we look for the HTML of the new post in the response
        var newPost = new RegExp('<!\-\- THE POST '+pid+' \-\->((.|\n)*?)<!\-\- THE POST \-\->');
        newPost = newPost.exec(response);
        if(!newPost)
        {
            alert("An error has occurred while saving your post.");
            formE.save.value = "Save";
            return;
        }
        newPost = newPost[1];
        
        // show the new version of the post
        var postE = document.getElementById('post-area-'+pid);
        postE.innerHTML = newPost;
        
        // clean up
        this.originalPostHtml[pid] = null;
        this.postIcons[pid] = null;
    }
}