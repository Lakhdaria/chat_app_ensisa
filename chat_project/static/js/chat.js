
//Application chatapp pour dev web a ENSISA
 

$(document).ready(function(){
    //les vars
    var chatMessages=$('#chat-messages');
    var messageForm=$('#message-form');
    var messageInput=$('#message-input');
    var emojiBtn=$('#emoji-btn');
    var emojiPicker =$('#emoji-picker');
    var voiceBtn=$('#voice-btn');
    var imageBtn=$('#image-btn');
    var imageInput=$('#image-input');
    var cameraBtn=$('#camera-btn');
    var salonId=chatMessages.data('salon-id');
    var userId=chatMessages.data('user-id');
    var username=chatMessages.data('username');
    var isModo=chatMessages.data('is-modo') == true;
    var isAdmin=chatMessages.data('is-admin') == true;
    var isSuperuser=chatMessages.data('is-superuser') == true;
    var csrfToken=$('input[name="csrfmiddlewaretoken"]').val();
    var lastMessageId=0;
    var refreshInterval;
    var tempMessageId=-1;
    //aud
    var mediaRecorder=null;
    var audioChunks=[];
    var recordingStartTime=null;
    var recordingTimer= null;
    var isRecording=false;
    var audioStream=null;
    //img
    var selectedImageData=null;
    var cameraStream=null;
    var emojis=['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', 
        '🙂', '😉', '😍', '🥰', '😘', '😋', '😛', '😜', '🤔', '😐', '😏', '😢', '😭', 
        '😤', '😡', '👍', '👎', '👌', '✌️', 
        '👋', '👏', '🙌', '🙏', '💪', '❤️', '🧡', '💛', '💚', 
        '💙', '💜', '🖤', '🔥', '⭐', '✨', '🎉', '🎊', '✅', '❌', '💯', '💬', '📸', '🎵', '🎤'];

    // Les fonctions d'init
    init();

    function init(){
        initLastMessageId();

        initEmojiPicker();

        scrollToBottom();

        startPolling();
        messageInput.focus();
    }

    function initLastMessageId(){
        chatMessages.find('.message').each(function(){
            var id = parseInt($(this).data('id')) || 0;
            if (id > lastMessageId) lastMessageId = id;
        });
    }


    function scrollToBottom(){
        chatMessages.scrollTop(chatMessages[0].scrollHeight);
    }


    function escapeHtml(text){
        var div=document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function getCurrentTime(){
        var now = new Date();
        var h=String(now.getHours()).padStart(2, '0');
        var m=String(now.getMinutes()).padStart(2, '0');
        return h+':'+ m;
    }

    function formatDuration(sec){
        var mins = Math.floor(sec/60);
        var secs = Math.floor(sec%60);
        return mins +':'+ String(secs).padStart(2, '0');
    }

    function showToast(message, type){
        type = type || 'info';
        var html = '<div class="toast align-items-center text-white bg-'+type+' border-0" role="alert" style="animation: slideIn 0.3s ease;">' +
            '<div class="d-flex"><div class="toast-body">' + message+'</div>'+
            '<button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>' +
            '</div></div>';
        var el=$(html);
        $('#toast-container').append(el);
        var toast = new bootstrap.Toast(el[0]);
        toast.show();
        el.on('hidden.bs.toast', function(){ $(this).remove(); });
    }

    //choisir emoji
    function initEmojiPicker() {
        var html = '<div class="emoji-grid">';
        for (var i = 0; i < emojis.length; i++) {
            html += '<span class="emoji-item" data-emoji="' + emojis[i] + '">' + emojis[i] + '</span>';
        }
        html += '</div>';
        emojiPicker.html(html);
    }

    //ajouter les messaes
    function appendMessage(msg, isOwn, isTemp){
        if (chatMessages.find('[data-id="' + msg.id + '"]').length > 0){
            return;
        }
        
        $('#no-messages').remove();
        
        //verif les droits
        var canDelete = isOwn || isModo || isAdmin || isSuperuser;
        var deleteBtn = '';
        if (canDelete && !isTemp){
            deleteBtn = '<button class="btn btn-link btn-sm text-danger p-0 ms-1 btn-delete-msg" data-msg-id="' + msg.id + '"><i class="bi bi-trash"></i></button>';
        }
        
        var content ='';
        if (msg.type ==='audio'){
            var audioUrl = msg.audio_url || '';
            var duree = msg.duree || 0;
            if (audioUrl) {
                content = '<div class="audio-message d-flex align-items-center gap-3">' +
                    '<button class="btn btn-play-audio"><i class="bi bi-play-fill"></i></button>' +
                    '<div class="flex-grow-1"><div class="audio-progress-bar"><div class="audio-progress"></div></div></div>' +
                    '<small class="text-white-50">'+formatDuration(duree)+'</small>' +
                    '<audio class="d-none" src="'+audioUrl +'" preload="metadata"></audio></div>';
            }
        }else if(msg.type==='image'){
            var imageUrl = msg.image_url || '';
            if (imageUrl) {
                content = '<div class="image-message">' +
                    '<img src="' + imageUrl + '" alt="Image" onclick="openImageModal(this.src)">' +
                    '</div>';
            }
        }else{
            content = '<div class="message-content">' + escapeHtml(msg.contenu || '') + '</div>';
        }
        
        var badge = isTemp ? '<span class="badge bg-secondary ms-1">...</span>' : '';
        var cls = 'message' + (isOwn ? ' message-own' : '') + (isTemp ? ' message-temp' : '');
        
        var html = '<div class="' + cls + '" data-id="' + msg.id + '">' +
            '<div class="d-flex justify-content-between align-items-center gap-2 mb-1">' +
            '<span class="message-author"><i class="bi bi-person-fill me-1"></i>' + escapeHtml(msg.auteur) + '</span>' +
            '<span class="message-time">' + msg.date_envoi + badge + deleteBtn + '</span></div>' +
            content + '</div>';
        
        chatMessages.append(html);
        scrollToBottom();
    }

    function envoyerMessage(contenu){
        if (!contenu) return;
        var tempId = tempMessageId--;
        appendMessage({id: tempId, contenu: contenu, type: 'text', auteur: username, date_envoi: getCurrentTime()}, true, true);
        messageInput.val('');
        
        $.ajax({
            url:'/api/salon/'+salonId+'/envoyer/',
            method:'POST',
            contentType:'application/json',
            headers:{'X-CSRFToken':csrfToken},
            data:JSON.stringify({contenu:contenu}),
            success: function(res){
                if (res.success){
                    var el =chatMessages.find('[data-id="' + tempId + '"]');
                    el.attr('data-id', res.message.id).removeClass('message-temp');
                    el.find('.badge').remove();
                    el.find('.message-time').append(
                        '<button class="btn btn-link btn-sm text-danger p-0 ms-1 btn-delete-msg" data-msg-id="' + res.message.id + '"><i class="bi bi-trash"></i></button>'
                    );
                    if (res.message.id > lastMessageId) lastMessageId = res.message.id;
                }
            },
            error: function(){
                chatMessages.find('[data-id="' + tempId + '"]').addClass('message-error')
                    .find('.badge').removeClass('bg-secondary').addClass('bg-danger').text('Erreur');
                showToast('Erreur d\'envoi', 'danger');
            }
        });
    }

    function chargerMessages(){
        $.ajax({
            url:'/api/salon/'+salonId+'/messages/',
            method:'GET',
            data:{last_id:lastMessageId},
            success:function(res){
                if (res.success&&res.messages){
                    for (var i=0;i<res.messages.length;i++){
                        var msg = res.messages[i];
                        if (!chatMessages.find('[data-id="'+msg.id +'"]').length){
                            appendMessage(msg, msg.auteur_id === userId, false);
                            if (msg.id > lastMessageId) lastMessageId = msg.id;
                        }
                    }
                }
                $('#connection-status-icon').removeClass('text-danger').addClass('text-success');
                $('#refresh-status').text('Connecté');
            },
            error:function(){
                $('#connection-status-icon').removeClass('text-success').addClass('text-danger');
                $('#refresh-status').text('Déconnecté');
            }
        });
    }

    function supprimerMessage(msgId){
        if (!confirm('Supprimer ce message ?')) return;
        
        $.ajax({
            url:'/api/salon/'+salonId+'/message/'+msgId+'/supprimer/',
            method:'POST',
            headers:{'X-CSRFToken':csrfToken},
            success: function(res){
                if (res.success){
                    chatMessages.find('[data-id="'+msgId +'"]').fadeOut(300, function(){
                        $(this).remove();
                    });
                    showToast('Message supprimé','success');
                }else{
                    showToast(res.error || 'Erreur', 'danger');
                }
            },
            error: function(xhr){
                showToast('Erreur de suppression', 'danger');
            }
        });
    }
    function initAudio(){
        return navigator.mediaDevices.getUserMedia({audio:true})
        .then(function(stream){
            audioStream=stream;
            var options={};
            if (MediaRecorder.isTypeSupported('audio/webm')){
                options.mimeType = 'audio/webm';
            }
            mediaRecorder=new MediaRecorder(stream,options);
            mediaRecorder.ondataavailable=function(e){
                if (e.data.size>0) audioChunks.push(e.data);
            };
            mediaRecorder.onstop=function(){
                if (audioChunks.length>0 && recordingStartTime){
                    var blob=new Blob(audioChunks,{type:'audio/webm'});
                    var duree=(Date.now()-recordingStartTime)/1000;
                    if (duree>=1){
                        envoyerAudio(blob, duree);
                    }else{
                        showToast('Enregistrement trop court','warning');
                    }
                }
                audioChunks=[];
                recordingStartTime=null;
            };
            return true;
        })
        .catch(function(err){
            console.error('Erreur micro:',err);
            showToast('Accès micro refusé','danger');
            return false;
        });
    }

    //gestion enregistrement
    function startRecording(){
        if (!mediaRecorder) return;
        audioChunks=[];
        recordingStartTime=Date.now();
        isRecording=true;
        mediaRecorder.start(100);
        $('#recording-status').removeClass('d-none');
        $('#btn-start-recording').addClass('d-none');
        $('#btn-stop-recording').removeClass('d-none');
        $('#recording-time').text('0:00');
        recordingTimer=setInterval(function(){
            var sec=(Date.now()-recordingStartTime)/1000;
            $('#recording-time').text(formatDuration(sec));
            if(sec>=60) stopRecording();
        },100);
    }

    function stopRecording(){
        if (!mediaRecorder || mediaRecorder.state!=='recording') return;
        isRecording=false;
        mediaRecorder.stop();
        clearInterval(recordingTimer);
        
        $('#recording-status').addClass('d-none');
        $('#btn-start-recording').removeClass('d-none');
        $('#btn-stop-recording').addClass('d-none');
        
        var modal=bootstrap.Modal.getInstance(document.getElementById('voiceModal'));
        if (modal) modal.hide();
    }

    function cancelRecording(){
        audioChunks=[];
        recordingStartTime=null;
        isRecording=false;
        if (mediaRecorder && mediaRecorder.state==='recording'){
            mediaRecorder.stop();
        }
        clearInterval(recordingTimer);
        $('#recording-status').addClass('d-none');
        $('#btn-start-recording').removeClass('d-none');
        $('#btn-stop-recording').addClass('d-none');
    }

    function envoyerAudio(blob,duree){
        showToast('Envoi audio...','info');
        
        var reader=new FileReader();
        reader.onloadend=function(){
            $.ajax({
                url:'/api/salon/'+salonId +'/audio/',
                method:'POST',
                contentType:'application/json',
                headers: {'X-CSRFToken':csrfToken},
                data: JSON.stringify({audio:reader.result,duree:duree}),
                success: function(res){
                    if (res.success && res.message){
                        showToast('Audio envoyé !', 'success');
                        appendMessage({
                            id:res.message.id,
                            type:'audio',
                            audio_url:res.message.audio_url,
                            duree:res.message.duree,
                            auteur:res.message.auteur,
                            auteur_id:res.message.auteur_id,
                            date_envoi:res.message.date_envoi
                        },true, false);
                        if(res.message.id > lastMessageId) lastMessageId=res.message.id;
                    }else{
                        showToast(res.error || 'Erreur','danger');
                    }
                },
                error:function(){
                    showToast('Erreur envoi audio', 'danger');
                }
            });
        };
        reader.readAsDataURL(blob);
    }

    function playAudio(btn){
        var container=btn.closest('.audio-message');
        var audio=container.find('audio')[0];
        var progress=container.find('.audio-progress');
        var icon=btn.find('i');
        
        if (!audio) return;
        
        $('.audio-message audio').each(function(){
            if (this !== audio && !this.paused){
                this.pause();
                this.currentTime = 0;
                $(this).closest('.audio-message').find('.btn-play-audio i')
                    .removeClass('bi-pause-fill').addClass('bi-play-fill');
            }
        });
        
        if(audio.paused){
            audio.play().then(function() {
                icon.removeClass('bi-play-fill').addClass('bi-pause-fill');
            }).catch(function(e) {
                showToast('Erreur de lecture','danger');
            });
            audio.ontimeupdate = function() {
                var pct = (audio.currentTime/audio.duration)*100 || 0;
                progress.css('width', pct+'%');
            };
            audio.onended = function() {
                icon.removeClass('bi-pause-fill').addClass('bi-play-fill');
                progress.css('width','0%');
            };
        }else{
            audio.pause();
            icon.removeClass('bi-pause-fill').addClass('bi-play-fill');
        }
    }

    //envoi image
    function handleImageSelect(file){
        if(!file){
            console.log('Err pas de fic');
            return;
        }
        if(!file.type.startsWith('image/')){
            showToast('Fichier non valide (image requise)', 'warning');
            return;
        }
        if(file.size>10*1024*1024){
            showToast('Image trop lourde (max 10MB)','warning');
            return;
        }
        console.log('Image sélectionnée:',file.name,file.type,file.size);
        var reader=new FileReader();
        reader.onload=function(e){
            selectedImageData=e.target.result;
            console.log('Image chargée, taille base64:',selectedImageData.length);
            $('#image-preview').attr('src',selectedImageData);
            $('#image-preview-container').css('display', 'block');
        };
        reader.onerror=function(err){
            console.error('Erreur lecture fichier:',err);
            showToast('Erreur lecture fichier','danger');
        };
        reader.readAsDataURL(file);
    }
    function removeImagePreview(){
        selectedImageData = null;
        $('#image-preview-container').css('display', 'none');
        $('#image-preview').attr('src', '');
        $('#image-input').val('');
    }

    function envoyerImage(imageData){
        if (!imageData){
            showToast('Aucune image sélectionnée', 'warning');
            return;
        }
        showToast('Envoi image...','info');
        console.log('Envoi image, taille:',imageData.length);
        
        $.ajax({
            url: '/api/salon/'+salonId+'/image/',
            method:'POST',
            contentType:'application/json',
            headers: {'X-CSRFToken':csrfToken},
            data: JSON.stringify({image:imageData }),
            success: function(res){
                console.log('Réponse serveur:',res);
                if (res.success && res.message){
                    showToast('Image envoyée !','success');
                    appendMessage({
                        id:res.message.id,
                        type:'image',
                        image_url:res.message.image_url,
                        auteur:res.message.auteur,
                        auteur_id:res.message.auteur_id,
                        date_envoi:res.message.date_envoi
                    },true,false);
                    if (res.message.id>lastMessageId) lastMessageId=res.message.id;
                    removeImagePreview();
                }else{
                    showToast(res.error || 'Erreur envoi', 'danger');
                }
            },
            error:function(xhr){
                console.error('Erreur AJAX:',xhr);
                var err='Erreur envoi image';
                if(xhr.responseJSON && xhr.responseJSON.error){
                    err=xhr.responseJSON.error;
                }
                showToast(err, 'danger');
            }
        });
    }

   //live camera

    function initCamera(){
        console.log('Init cam');
        var constraints = {
            video:{
                facingMode:'environment',
                width:{ideal:1280},
                height:{ideal:720}
            }
        };
        return navigator.mediaDevices.getUserMedia(constraints)
        .then(function(stream){
            cameraStream=stream;
            var video=document.getElementById('camera-video');
            video.srcObject=stream;
            console.log('Cam init');
            return true;
        })
        .catch(function(err){
            console.error('Err cam:', err);
            // Essayer avec la caméra frontale si l'arrière échoue
            return navigator.mediaDevices.getUserMedia({ video: true })
            .then(function(stream){
                cameraStream=stream;
                var video=document.getElementById('camera-video');
                video.srcObject=stream;
                console.log('Frontal cam init');
                return true;
            })
            .catch(function(err2){
                console.error('Frontal cam err:',err2);
                showToast('Accès caméra refusé','danger');
                return false;
            });
        });
    }

    function stopCamera(){
        if (cameraStream){
            cameraStream.getTracks().forEach(function(track){
                track.stop();
            });
            cameraStream=null;
            console.log('Cam stop');
        }
        var video=document.getElementById('camera-video');
        if (video){
            video.srcObject=null;
        }
    }

    function takePhoto(){
        var video=document.getElementById('camera-video');
        var canvas=document.getElementById('camera-canvas');
        if(!video || !canvas){
            showToast('Erreur: éléments non trouvés','danger');
            return;
        }
        var ctx=canvas.getContext('2d');
        //dim, defaut 640x480
        canvas.width=video.videoWidth || 640;
        canvas.height=video.videoHeight || 480;
        console.log('Capture photo:', canvas.width, 'x', canvas.height);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        var imageData=canvas.toDataURL('image/jpeg', 0.85);
        stopCamera();
        var modal = bootstrap.Modal.getInstance(document.getElementById('cameraModal'));
        if (modal){
            modal.hide();
        } 
        envoyerImage(imageData);
    }

    function startPolling(){
        refreshInterval=setInterval(chargerMessages, 2000);
    }

    
    //listeners

    // Message form
    messageForm.on('submit',function(e){
        e.preventDefault();
        if(selectedImageData){
            envoyerImage(selectedImageData);
        }else{
            var contenu=messageInput.val().trim();
            if(contenu){
                envoyerMessage(contenu);
            }
        }
    });

    // Emojis
    emojiBtn.on('click', function(e){
        e.preventDefault();
        e.stopPropagation();
        emojiPicker.toggleClass('show');
    });

    $(document).on('click','.emoji-item',function(){
        messageInput.val(messageInput.val()+$(this).data('emoji'));
        emojiPicker.removeClass('show');
        messageInput.focus();
    });
    $(document).on('click', function(e){
        if(!$(e.target).closest('#emoji-picker, #emoji-btn').length){
            emojiPicker.removeClass('show');
        }
    });

    // Voice
    voiceBtn.on('click', function(){
        if (!mediaRecorder){
            initAudio().then(function(ok) {
                if(ok){
                    var modal = new bootstrap.Modal(document.getElementById('voiceModal'));
                    modal.show();
                }
            });
        }else{
            var modal=new bootstrap.Modal(document.getElementById('voiceModal'));
            modal.show();
        }
    });

    $(document).on('click','#btn-start-recording',startRecording);
    $(document).on('click','#btn-stop-recording',stopRecording);
    $(document).on('click','#btn-cancel-recording',function(){
        cancelRecording();
    });

    $('#voiceModal').on('hidden.bs.modal',function(){
        if (isRecording) cancelRecording();
    });

    //select file
    imageBtn.on('click', function(e){
        e.preventDefault();
        imageInput.trigger('click');
    });

    //chg file
    imageInput.on('change', function(e){
        var file = this.files[0];
        if(file){
            handleImageSelect(file);
        }
    });

    //Cam click
    cameraBtn.on('click', function(e){
        e.preventDefault();
        var modal = new bootstrap.Modal(document.getElementById('cameraModal'));
        modal.show();
        setTimeout(function(){
            initCamera();
        }, 300);
    });

    $(document).on('click', '#btn-take-photo', function(e){
        e.preventDefault();
        takePhoto();
    });
    $('#cameraModal').on('hidden.bs.modal', function(){
        console.log('Modal caméra fermé');
        stopCamera();
    });

    //jouer audio
    $(document).on('click', '.btn-play-audio', function(e){
        e.preventDefault();
        playAudio($(this));
    });

    // Delete message
    $(document).on('click', '.btn-delete-msg', function(e){
        e.preventDefault();
        e.stopPropagation();
        var msgId = $(this).data('msg-id');
        if (msgId){
            supprimerMessage(msgId);
        }
    });

    //Moderation
    $(document).on('click','.btn-role',function(e){
        e.preventDefault();
        var uid=$(this).data('user-id');
        var role=$(this).data('role');
        $.ajax({
            url:'/api/salon/'+salonId+'/membre/'+uid+'/role/',
            method:'POST',
            contentType:'application/json',
            headers:{'X-CSRFToken':csrfToken},
            data:JSON.stringify({role:role}),
            success:function(res){
                if(res.success){
                    showToast(res.message,'success');
                    setTimeout(function(){location.reload();}, 1000);
                }
            },
            error: function(xhr){
                showToast(xhr.responseJSON ? xhr.responseJSON.error : 'Erreur', 'danger');
            }
        });
    });

    $(document).on('click','.btn-ban',function(e){
        e.preventDefault();
        var uid = $(this).data('user-id');
        $.ajax({
            url:'/api/salon/'+salonId+'/membre/'+ uid +'/bannir/',
            method:'POST',
            contentType:'application/json',
            headers: {'X-CSRFToken':csrfToken},
            data: JSON.stringify({ action:'ban'}),
            success: function(res){
                if (res.success){
                    showToast(res.message, 'success');
                    setTimeout(function() { location.reload(); }, 1000);
                }
            }
        });
    });

    $(document).on('click', '.btn-unban', function(e){
        e.preventDefault();
        var uid = $(this).data('user-id');
        $.ajax({
            url:'/api/salon/'+salonId +'/membre/'+uid+'/bannir/',
            method:'POST',
            contentType: 'application/json',
            headers: { 'X-CSRFToken': csrfToken },
            data:JSON.stringify({ action: 'unban' }),
            success:function(res){
                if (res.success) {
                    showToast(res.message, 'success');
                    setTimeout(function(){location.reload();}, 1000);
                }
            }
        });
    });

    $(document).on('click', '.btn-kick', function(e){
        e.preventDefault();
        if (!confirm('Expulser ce membre ?')) return;
        var uid = $(this).data('user-id');
        $.ajax({
            url:'/api/salon/'+salonId +'/membre/'+uid+'/expulser/',
            method:'POST',
            headers:{ 'X-CSRFToken': csrfToken },
            success: function(res){
                if(res.success){
                    showToast(res.message, 'success');
                    setTimeout(function() { location.reload(); }, 1000);
                }
            }
        });
    });

    $('#btn-invite-confirm').on('click', function(){
        var name = $('#invite-username').val().trim();
        if (!name) { showToast('Entrez un nom', 'warning'); return; }
        $.ajax({
            url: '/api/salon/' + salonId + '/inviter/',
            method: 'POST',
            contentType: 'application/json',
            headers: { 'X-CSRFToken': csrfToken },
            data: JSON.stringify({ username: name }),
            success: function(res) {
                if (res.success) {
                    showToast(res.message, 'success');
                    $('#invite-username').val('');
                    bootstrap.Modal.getInstance(document.getElementById('inviteModal')).hide();
                    setTimeout(function() { location.reload(); }, 1000);
                }
            },
            error: function(xhr){
                showToast(xhr.responseJSON ? xhr.responseJSON.error : 'Erreur', 'danger');
            }
        });
    });

    //drag/drop
    chatMessages.on('dragover', function(e){
        e.preventDefault();
        $(this).addClass('drag-over');
    });

    chatMessages.on('dragleave', function(e){
        e.preventDefault();
        $(this).removeClass('drag-over');
    });

    chatMessages.on('drop', function(e){
        e.preventDefault();
        $(this).removeClass('drag-over');
        var files=e.originalEvent.dataTransfer.files;
        if (files.length>0 && files[0].type.startsWith('image/')) {
            handleImageSelect(files[0]);
        }
    });

    //coller img
    $(document).on('paste', function(e) {
        var items=e.originalEvent.clipboardData.items;
        for (var i=0; i<items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                var file = items[i].getAsFile();
                handleImageSelect(file);
                break;
            }
        }
    });

    //unload
    $(window).on('beforeunload', function() {
        clearInterval(refreshInterval);
        if (isRecording) cancelRecording();
        if (audioStream) {
            audioStream.getTracks().forEach(function(track) { track.stop(); });
        }
        stopCamera();
    });
});

//global
function openImageModal(src) {
    $('#modal-image').attr('src', src);
    $('#image-modal').addClass('show');
}

function removeImagePreview() {
    $('#image-preview-container').css('display', 'none');
    $('#image-preview').attr('src', '');
    $('#image-input').val('');
}