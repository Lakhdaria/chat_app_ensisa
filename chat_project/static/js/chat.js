/**
 * Chat Application - JavaScript Client
 * Avec emojis, messages vocaux, et images
 */

$(document).ready(function() {
    var chatMessages = $('#chat-messages');
    var messageForm = $('#message-form');
    var messageInput = $('#message-input');
    var emojiBtn = $('#emoji-btn');
    var emojiPicker = $('#emoji-picker');
    var voiceBtn = $('#voice-btn');
    var imageBtn = $('#image-btn');
    var imageInput = $('#image-input');
    var cameraBtn = $('#camera-btn');
    
    var salonId = chatMessages.data('salon-id');
    var userId = chatMessages.data('user-id');
    var username = chatMessages.data('username');
    var isModo = chatMessages.data('is-modo') == true || chatMessages.data('is-modo') == 'True';
    var isAdmin = chatMessages.data('is-admin') == true || chatMessages.data('is-admin') == 'True';
    var csrfToken = $('input[name="csrfmiddlewaretoken"]').val();
    
    var lastMessageId = 0;
    var refreshInterval;
    var tempMessageId = -1;
    
    var mediaRecorder = null;
    var audioChunks = [];
    var recordingStartTime = null;
    var recordingTimer = null;
    var isRecording = false;
    var audioStream = null;
    var selectedImageData = null;
    var cameraStream = null;

    var emojis = ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😍', '🥰', '😘', '😋', '😛', '😜', '🤔', '😐', '😏', '😢', '😭', '😤', '😡', '👍', '👎', '👌', '✌️', '👋', '👏', '🙌', '🙏', '💪', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🔥', '⭐', '✨', '🎉', '🎊', '✅', '❌', '💯', '💬', '📸', '🎵', '🎤'];

    init();

    function init() {
        initLastMessageId();
        initEmojiPicker();
        scrollToBottom();
        startPolling();
        messageInput.focus();
    }

    function initLastMessageId() {
        chatMessages.find('.message').each(function() {
            var id = parseInt($(this).data('id')) || 0;
            if (id > lastMessageId) lastMessageId = id;
        });
    }

    function scrollToBottom() {
        chatMessages.scrollTop(chatMessages[0].scrollHeight);
    }

    function escapeHtml(text) {
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function getCurrentTime() {
        var now = new Date();
        return String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    }

    function formatDuration(sec) {
        return Math.floor(sec / 60) + ':' + String(Math.floor(sec % 60)).padStart(2, '0');
    }
    
    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' o';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' Ko';
        return (bytes / (1024 * 1024)).toFixed(1) + ' Mo';
    }

    function showToast(message, type) {
        type = type || 'info';
        var el = $('<div class="toast align-items-center text-white bg-' + type + ' border-0" role="alert"><div class="d-flex"><div class="toast-body">' + message + '</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div></div>');
        $('#toast-container').append(el);
        var toast = new bootstrap.Toast(el[0]);
        toast.show();
        el.on('hidden.bs.toast', function() { $(this).remove(); });
    }

    function initEmojiPicker() {
        var html = '<div class="emoji-grid">';
        for (var i = 0; i < emojis.length; i++) {
            html += '<span class="emoji-item" data-emoji="' + emojis[i] + '">' + emojis[i] + '</span>';
        }
        emojiPicker.html(html + '</div>');
    }

    function appendMessage(msg, isOwn, isTemp) {
        if (chatMessages.find('[data-id="' + msg.id + '"]').length > 0) return;
        $('#no-messages').remove();
        
        var deleteBtn = (isOwn || isModo || isAdmin) && !isTemp ? '<button class="btn btn-link btn-sm text-danger p-0 ms-1 btn-delete-msg" data-msg-id="' + msg.id + '"><i class="bi bi-trash"></i></button>' : '';
        var content = '';
        
        if (msg.type === 'audio' && msg.audio_url) {
            content = '<div class="audio-message d-flex align-items-center gap-3"><button class="btn btn-play-audio"><i class="bi bi-play-fill"></i></button><div class="flex-grow-1"><div class="audio-progress-bar"><div class="audio-progress"></div></div></div><small style="color:var(--text-muted);">' + formatDuration(msg.duree || 0) + '</small><audio class="d-none" src="' + msg.audio_url + '" preload="metadata"></audio></div>';
        } else if (msg.type === 'image' && msg.image_url) {
            content = '<div class="image-message"><img src="' + msg.image_url + '" alt="Image" onclick="openImageModal(this.src)"></div>';
        } else {
            content = '<div class="message-content">' + escapeHtml(msg.contenu || '') + '</div>';
        }
        
        var badge = isTemp ? '<span class="badge bg-secondary ms-1">...</span>' : '';
        var html = '<div class="message' + (isOwn ? ' message-own' : '') + (isTemp ? ' message-temp' : '') + '" data-id="' + msg.id + '"><div class="d-flex justify-content-between align-items-center gap-2 mb-1"><span class="message-author"><i class="bi bi-person-fill me-1"></i>' + escapeHtml(msg.auteur) + '</span><span class="message-time">' + msg.date_envoi + badge + deleteBtn + '</span></div>' + content + '</div>';
        
        chatMessages.append(html);
        scrollToBottom();
    }

    function envoyerMessage(contenu) {
        if (!contenu) return;
        var tempId = tempMessageId--;
        appendMessage({id: tempId, contenu: contenu, type: 'text', auteur: username, date_envoi: getCurrentTime()}, true, true);
        messageInput.val('');
        
        $.ajax({
            url: '/api/salon/' + salonId + '/envoyer/',
            method: 'POST',
            contentType: 'application/json',
            headers: { 'X-CSRFToken': csrfToken },
            data: JSON.stringify({ contenu: contenu }),
            success: function(res) {
                if (res.success) {
                    var el = chatMessages.find('[data-id="' + tempId + '"]');
                    el.attr('data-id', res.message.id).removeClass('message-temp').find('.badge').remove();
                    el.find('.message-time').append('<button class="btn btn-link btn-sm text-danger p-0 ms-1 btn-delete-msg" data-msg-id="' + res.message.id + '"><i class="bi bi-trash"></i></button>');
                    if (res.message.id > lastMessageId) lastMessageId = res.message.id;
                }
            },
            error: function() {
                chatMessages.find('[data-id="' + tempId + '"]').find('.badge').removeClass('bg-secondary').addClass('bg-danger').text('Erreur');
                showToast('Erreur d\'envoi', 'danger');
            }
        });
    }

    function chargerMessages() {
        $.ajax({
            url: '/api/salon/' + salonId + '/messages/',
            data: { last_id: lastMessageId },
            success: function(res) {
                if (res.success && res.messages) {
                    res.messages.forEach(function(msg) {
                        if (!chatMessages.find('[data-id="' + msg.id + '"]').length) {
                            appendMessage(msg, msg.auteur_id === userId, false);
                            if (msg.id > lastMessageId) lastMessageId = msg.id;
                        }
                    });
                }
                $('#connection-status-icon').removeClass('text-danger').addClass('text-success');
                $('#refresh-status').text('Connecté');
            },
            error: function() {
                $('#connection-status-icon').removeClass('text-success').addClass('text-danger');
                $('#refresh-status').text('Déconnecté');
            }
        });
    }

    function supprimerMessage(msgId) {
        if (!confirm('Supprimer ce message ?')) return;
        $.ajax({
            url: '/api/salon/' + salonId + '/message/' + msgId + '/supprimer/',
            method: 'POST',
            headers: { 'X-CSRFToken': csrfToken },
            success: function(res) {
                if (res.success) {
                    chatMessages.find('[data-id="' + msgId + '"]').fadeOut(300, function() { $(this).remove(); });
                    showToast('Message supprimé', 'success');
                }
            }
        });
    }

    function initAudio() {
        return navigator.mediaDevices.getUserMedia({ audio: true }).then(function(stream) {
            audioStream = stream;
            mediaRecorder = new MediaRecorder(stream, MediaRecorder.isTypeSupported('audio/webm') ? {mimeType: 'audio/webm'} : {});
            mediaRecorder.ondataavailable = function(e) { if (e.data.size > 0) audioChunks.push(e.data); };
            mediaRecorder.onstop = function() {
                if (audioChunks.length > 0 && recordingStartTime) {
                    var duree = (Date.now() - recordingStartTime) / 1000;
                    if (duree >= 1) envoyerAudio(new Blob(audioChunks, { type: 'audio/webm' }), duree);
                }
                audioChunks = [];
                recordingStartTime = null;
            };
            return true;
        }).catch(function() { showToast('Accès micro refusé', 'danger'); return false; });
    }

    function startRecording() {
        if (!mediaRecorder) return;
        audioChunks = [];
        recordingStartTime = Date.now();
        isRecording = true;
        mediaRecorder.start(100);
        $('#recording-status').removeClass('d-none');
        $('#btn-start-recording').addClass('d-none');
        $('#btn-stop-recording').removeClass('d-none');
        recordingTimer = setInterval(function() {
            var sec = (Date.now() - recordingStartTime) / 1000;
            $('#recording-time').text(formatDuration(sec));
            if (sec >= 60) stopRecording();
        }, 100);
    }

    function stopRecording() {
        if (!mediaRecorder || mediaRecorder.state !== 'recording') return;
        isRecording = false;
        mediaRecorder.stop();
        clearInterval(recordingTimer);
        $('#recording-status').addClass('d-none');
        $('#btn-start-recording').removeClass('d-none');
        $('#btn-stop-recording').addClass('d-none');
        var modal = bootstrap.Modal.getInstance(document.getElementById('voiceModal'));
        if (modal) modal.hide();
    }

    function cancelRecording() {
        audioChunks = [];
        recordingStartTime = null;
        isRecording = false;
        if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
        clearInterval(recordingTimer);
        $('#recording-status').addClass('d-none');
        $('#btn-start-recording').removeClass('d-none');
        $('#btn-stop-recording').addClass('d-none');
    }

    function envoyerAudio(blob, duree) {
        showToast('Envoi audio...', 'info');
        var reader = new FileReader();
        reader.onloadend = function() {
            $.ajax({
                url: '/api/salon/' + salonId + '/audio/',
                method: 'POST',
                contentType: 'application/json',
                headers: { 'X-CSRFToken': csrfToken },
                data: JSON.stringify({ audio: reader.result, duree: duree }),
                success: function(res) {
                    if (res.success) {
                        showToast('Audio envoyé !', 'success');
                        appendMessage(res.message, true, false);
                        if (res.message.id > lastMessageId) lastMessageId = res.message.id;
                    }
                }
            });
        };
        reader.readAsDataURL(blob);
    }

    function playAudio(btn) {
        var container = btn.closest('.audio-message');
        var audio = container.find('audio')[0];
        var progress = container.find('.audio-progress');
        var icon = btn.find('i');
        if (!audio) return;
        
        $('.audio-message audio').each(function() {
            if (this !== audio && !this.paused) {
                this.pause();
                this.currentTime = 0;
                $(this).closest('.audio-message').find('.btn-play-audio i').removeClass('bi-pause-fill').addClass('bi-play-fill');
            }
        });
        
        if (audio.paused) {
            audio.play();
            icon.removeClass('bi-play-fill').addClass('bi-pause-fill');
            audio.ontimeupdate = function() { progress.css('width', (audio.currentTime / audio.duration * 100) + '%'); };
            audio.onended = function() { icon.removeClass('bi-pause-fill').addClass('bi-play-fill'); progress.css('width', '0%'); };
        } else {
            audio.pause();
            icon.removeClass('bi-pause-fill').addClass('bi-play-fill');
        }
    }

    function handleImageSelect(file) {
        if (!file || !file.type.startsWith('image/')) { showToast('Image requise', 'warning'); return; }
        if (file.size > 10 * 1024 * 1024) { showToast('Max 10MB', 'warning'); return; }
        
        var reader = new FileReader();
        reader.onload = function(e) {
            selectedImageData = e.target.result;
            $('#image-preview').attr('src', selectedImageData);
            $('#image-preview-name').text(file.name + ' (' + formatFileSize(file.size) + ')');
            $('#image-preview-wrapper').addClass('show');
        };
        reader.readAsDataURL(file);
    }

    function envoyerImage(imageData) {
        if (!imageData) return;
        showToast('Envoi image...', 'info');
        $.ajax({
            url: '/api/salon/' + salonId + '/image/',
            method: 'POST',
            contentType: 'application/json',
            headers: { 'X-CSRFToken': csrfToken },
            data: JSON.stringify({ image: imageData }),
            success: function(res) {
                if (res.success) {
                    showToast('Image envoyée !', 'success');
                    appendMessage(res.message, true, false);
                    if (res.message.id > lastMessageId) lastMessageId = res.message.id;
                    selectedImageData = null;
                    $('#image-preview-wrapper').removeClass('show');
                    $('#image-input').val('');
                }
            },
            error: function(xhr) {
                showToast(xhr.responseJSON ? xhr.responseJSON.error : 'Erreur', 'danger');
            }
        });
    }

    function initCamera() {
        return navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(function(stream) {
            cameraStream = stream;
            document.getElementById('camera-video').srcObject = stream;
            return true;
        }).catch(function() {
            return navigator.mediaDevices.getUserMedia({ video: true }).then(function(stream) {
                cameraStream = stream;
                document.getElementById('camera-video').srcObject = stream;
                return true;
            }).catch(function() { showToast('Accès caméra refusé', 'danger'); return false; });
        });
    }

    function stopCamera() {
        if (cameraStream) { cameraStream.getTracks().forEach(function(t) { t.stop(); }); cameraStream = null; }
        var v = document.getElementById('camera-video');
        if (v) v.srcObject = null;
    }

    function takePhoto() {
        var video = document.getElementById('camera-video');
        var canvas = document.getElementById('camera-canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
        var imageData = canvas.toDataURL('image/jpeg', 0.85);
        stopCamera();
        bootstrap.Modal.getInstance(document.getElementById('cameraModal')).hide();
        envoyerImage(imageData);
    }

    function startPolling() { refreshInterval = setInterval(chargerMessages, 2000); }

    // Event Listeners
    messageForm.on('submit', function(e) { e.preventDefault(); var c = messageInput.val().trim(); if (c) envoyerMessage(c); });
    emojiBtn.on('click', function(e) { e.preventDefault(); e.stopPropagation(); emojiPicker.toggleClass('show'); });
    $(document).on('click', '.emoji-item', function() { messageInput.val(messageInput.val() + $(this).data('emoji')); emojiPicker.removeClass('show'); messageInput.focus(); });
    $(document).on('click', function(e) { if (!$(e.target).closest('#emoji-picker, #emoji-btn').length) emojiPicker.removeClass('show'); });
    
    voiceBtn.on('click', function() {
        if (!mediaRecorder) initAudio().then(function(ok) { if (ok) new bootstrap.Modal(document.getElementById('voiceModal')).show(); });
        else new bootstrap.Modal(document.getElementById('voiceModal')).show();
    });
    $(document).on('click', '#btn-start-recording', startRecording);
    $(document).on('click', '#btn-stop-recording', stopRecording);
    $(document).on('click', '#btn-cancel-recording', cancelRecording);
    $('#voiceModal').on('hidden.bs.modal', function() { if (isRecording) cancelRecording(); });
    
    imageBtn.on('click', function(e) { e.preventDefault(); imageInput.trigger('click'); });
    imageInput.on('change', function() { if (this.files[0]) handleImageSelect(this.files[0]); });
    $(document).on('click', '#btn-send-image', function(e) { e.preventDefault(); if (selectedImageData) envoyerImage(selectedImageData); });
    
    cameraBtn.on('click', function(e) { e.preventDefault(); new bootstrap.Modal(document.getElementById('cameraModal')).show(); setTimeout(initCamera, 300); });
    $(document).on('click', '#btn-take-photo', function(e) { e.preventDefault(); takePhoto(); });
    $('#cameraModal').on('hidden.bs.modal', stopCamera);
    
    $(document).on('click', '.btn-play-audio', function(e) { e.preventDefault(); playAudio($(this)); });
    $(document).on('click', '.btn-delete-msg', function(e) { e.preventDefault(); e.stopPropagation(); supprimerMessage($(this).data('msg-id')); });
    
    $(document).on('click', '.btn-role', function(e) {
        e.preventDefault();
        $.ajax({ url: '/api/salon/' + salonId + '/membre/' + $(this).data('user-id') + '/role/', method: 'POST', contentType: 'application/json', headers: { 'X-CSRFToken': csrfToken }, data: JSON.stringify({ role: $(this).data('role') }), success: function(res) { if (res.success) { showToast(res.message, 'success'); setTimeout(function() { location.reload(); }, 1000); } } });
    });
    $(document).on('click', '.btn-ban', function(e) { e.preventDefault(); $.ajax({ url: '/api/salon/' + salonId + '/membre/' + $(this).data('user-id') + '/bannir/', method: 'POST', contentType: 'application/json', headers: { 'X-CSRFToken': csrfToken }, data: JSON.stringify({ action: 'ban' }), success: function(res) { if (res.success) { showToast(res.message, 'success'); setTimeout(function() { location.reload(); }, 1000); } } }); });
    $(document).on('click', '.btn-unban', function(e) { e.preventDefault(); $.ajax({ url: '/api/salon/' + salonId + '/membre/' + $(this).data('user-id') + '/bannir/', method: 'POST', contentType: 'application/json', headers: { 'X-CSRFToken': csrfToken }, data: JSON.stringify({ action: 'unban' }), success: function(res) { if (res.success) { showToast(res.message, 'success'); setTimeout(function() { location.reload(); }, 1000); } } }); });
    $(document).on('click', '.btn-kick', function(e) { e.preventDefault(); if (!confirm('Expulser ?')) return; $.ajax({ url: '/api/salon/' + salonId + '/membre/' + $(this).data('user-id') + '/expulser/', method: 'POST', headers: { 'X-CSRFToken': csrfToken }, success: function(res) { if (res.success) { showToast(res.message, 'success'); setTimeout(function() { location.reload(); }, 1000); } } }); });
    
    $('#btn-invite-confirm').on('click', function() {
        var name = $('#invite-username').val().trim();
        if (!name) { showToast('Entrez un nom', 'warning'); return; }
        $.ajax({ url: '/api/salon/' + salonId + '/inviter/', method: 'POST', contentType: 'application/json', headers: { 'X-CSRFToken': csrfToken }, data: JSON.stringify({ username: name }), success: function(res) { if (res.success) { showToast(res.message, 'success'); bootstrap.Modal.getInstance(document.getElementById('inviteModal')).hide(); setTimeout(function() { location.reload(); }, 1000); } }, error: function(xhr) { showToast(xhr.responseJSON ? xhr.responseJSON.error : 'Erreur', 'danger'); } });
    });
    
    chatMessages.on('dragover', function(e) { e.preventDefault(); }).on('drop', function(e) { e.preventDefault(); var f = e.originalEvent.dataTransfer.files; if (f.length && f[0].type.startsWith('image/')) handleImageSelect(f[0]); });
    $(document).on('paste', function(e) { var items = e.originalEvent.clipboardData.items; for (var i = 0; i < items.length; i++) { if (items[i].type.indexOf('image') !== -1) { handleImageSelect(items[i].getAsFile()); break; } } });
    
    $(window).on('beforeunload', function() { clearInterval(refreshInterval); if (isRecording) cancelRecording(); if (audioStream) audioStream.getTracks().forEach(function(t) { t.stop(); }); stopCamera(); });
});

function openImageModal(src) { $('#modal-image').attr('src', src); $('#image-modal').addClass('show'); }
function removeImagePreview() { $('#image-preview-wrapper').removeClass('show'); $('#image-preview').attr('src', ''); $('#image-input').val(''); }
