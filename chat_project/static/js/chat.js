/**
 * Chat Application - JavaScript Client
 */

$(document).ready(function() {
    var chatMessages = $('#chat-messages');
    var messageForm = $('#message-form');
    var messageInput = $('#message-input');
    var emojiBtn = $('#emoji-btn');
    var emojiPicker = $('#emoji-picker');
    var voiceBtn = $('#voice-btn');
    
    var salonId = chatMessages.data('salon-id');
    var userId = chatMessages.data('user-id');
    var username = chatMessages.data('username');
    var isModo = chatMessages.data('is-modo') == true || chatMessages.data('is-modo') == 'True';
    var isAdmin = chatMessages.data('is-admin') == true || chatMessages.data('is-admin') == 'True';
    var csrfToken = $('input[name="csrfmiddlewaretoken"]').val();
    
    var lastMessageId = 0;
    var refreshInterval;
    var tempMessageId = -1;
    
    // Audio
    var mediaRecorder = null;
    var audioChunks = [];
    var recordingStartTime = null;
    var recordingTimer = null;
    var isRecording = false;
    var audioStream = null;
    var audioMimeType = 'audio/webm';

    // Emojis
    var emojis = ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😍', '🥰', '😘', '😋', '😛', '😜', '🤔', '😐', '😏', '😢', '😭', '😤', '😡', '👍', '👎', '👌', '✌️', '👋', '👏', '🙌', '🙏', '💪', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🔥', '⭐', '✨', '🎉', '🎊', '✅', '❌', '💯'];

    // Initialisation
    init();

    function init() {
        initLastMessageId();
        initEmojiPicker();
        scrollToBottom();
        startPolling();
        messageInput.focus();
        console.log('Chat initialisé - Admin:', isAdmin, '- Modo:', isModo);
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
        var h = String(now.getHours()).padStart(2, '0');
        var m = String(now.getMinutes()).padStart(2, '0');
        return h + ':' + m;
    }

    function formatDuration(sec) {
        var mins = Math.floor(sec / 60);
        var secs = Math.floor(sec % 60);
        return mins + ':' + String(secs).padStart(2, '0');
    }

    function showToast(message, type) {
        type = type || 'info';
        var html = '<div class="toast align-items-center text-white bg-' + type + ' border-0" role="alert">' +
            '<div class="d-flex"><div class="toast-body">' + message + '</div>' +
            '<button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>' +
            '</div></div>';
        var el = $(html);
        $('#toast-container').append(el);
        var toast = new bootstrap.Toast(el[0]);
        toast.show();
        el.on('hidden.bs.toast', function() { $(this).remove(); });
    }

    // Emoji Picker
    function initEmojiPicker() {
        var html = '<div class="emoji-picker-content p-2"><div class="emoji-grid">';
        for (var i = 0; i < emojis.length; i++) {
            html += '<span class="emoji-item" data-emoji="' + emojis[i] + '">' + emojis[i] + '</span>';
        }
        html += '</div></div>';
        emojiPicker.html(html);
    }

    // Messages
    function appendMessage(msg, isOwn, isTemp) {
        // Vérifier si le message existe déjà
        if (chatMessages.find('[data-id="' + msg.id + '"]').length > 0) {
            return;
        }
        
        $('#no-messages').remove();
        
        var canDelete = isOwn || isModo || isAdmin;
        var deleteBtn = '';
        if (canDelete && !isTemp) {
            deleteBtn = '<button class="btn btn-link btn-sm text-danger p-0 ms-1 btn-delete-msg" data-msg-id="' + msg.id + '"><i class="bi bi-trash"></i></button>';
        }
        
        var content = '';
        if (msg.type === 'audio') {
            var audioUrl = msg.audio_url || '';
            var duree = msg.duree || 0;
            
            if (audioUrl) {
                content = '<div class="audio-message d-flex align-items-center gap-2 mt-1">' +
                    '<button class="btn btn-primary btn-sm rounded-circle btn-play-audio" style="width:36px;height:36px;">' +
                    '<i class="bi bi-play-fill"></i></button>' +
                    '<div class="flex-grow-1"><div class="audio-progress-bar"><div class="audio-progress"></div></div></div>' +
                    '<small class="text-muted">' + formatDuration(duree) + '</small>' +
                    '<audio preload="auto" src="' + audioUrl + '"></audio></div>';
            } else {
                content = '<div class="text-muted small"><i class="bi bi-exclamation-circle"></i> Audio non disponible</div>';
            }
        } else {
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

    function envoyerMessage(contenu) {
        if (!contenu) return;
        
        var tempId = tempMessageId--;
        appendMessage({
            id: tempId,
            contenu: contenu,
            type: 'text',
            auteur: username,
            date_envoi: getCurrentTime()
        }, true, true);
        
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
                    el.attr('data-id', res.message.id).removeClass('message-temp');
                    el.find('.badge').remove();
                    el.find('.message-time').append(
                        '<button class="btn btn-link btn-sm text-danger p-0 ms-1 btn-delete-msg" data-msg-id="' + res.message.id + '"><i class="bi bi-trash"></i></button>'
                    );
                    if (res.message.id > lastMessageId) lastMessageId = res.message.id;
                }
            },
            error: function() {
                chatMessages.find('[data-id="' + tempId + '"]').addClass('message-error')
                    .find('.badge').removeClass('bg-secondary').addClass('bg-danger').text('Erreur');
                showToast('Erreur d\'envoi', 'danger');
            }
        });
    }

    function chargerMessages() {
        $.ajax({
            url: '/api/salon/' + salonId + '/messages/',
            method: 'GET',
            data: { last_id: lastMessageId },
            success: function(res) {
                if (res.success && res.messages) {
                    for (var i = 0; i < res.messages.length; i++) {
                        var msg = res.messages[i];
                        if (!chatMessages.find('[data-id="' + msg.id + '"]').length) {
                            appendMessage(msg, msg.auteur_id === userId, false);
                            if (msg.id > lastMessageId) lastMessageId = msg.id;
                        }
                    }
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
                    chatMessages.find('[data-id="' + msgId + '"]').fadeOut(200, function() {
                        $(this).remove();
                    });
                    showToast('Message supprimé', 'success');
                } else {
                    showToast(res.error || 'Erreur', 'danger');
                }
            },
            error: function(xhr) {
                var err = 'Erreur de suppression';
                if (xhr.responseJSON && xhr.responseJSON.error) {
                    err = xhr.responseJSON.error;
                }
                showToast(err, 'danger');
            }
        });
    }

    // Audio Recording
    function getSupportedMimeType() {
        var types = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/ogg;codecs=opus',
            'audio/mp4',
            'audio/mpeg'
        ];
        
        for (var i = 0; i < types.length; i++) {
            if (MediaRecorder.isTypeSupported(types[i])) {
                console.log('Format audio supporté:', types[i]);
                return types[i];
            }
        }
        
        console.log('Aucun format spécifique supporté, utilisation du défaut');
        return '';
    }

    function initAudio() {
        return navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        })
        .then(function(stream) {
            audioStream = stream;
            audioMimeType = getSupportedMimeType();
            
            var options = {};
            if (audioMimeType) {
                options.mimeType = audioMimeType;
            }
            
            mediaRecorder = new MediaRecorder(stream, options);
            console.log('MediaRecorder créé avec:', mediaRecorder.mimeType);
            
            mediaRecorder.ondataavailable = function(e) {
                console.log('Data available:', e.data.size, 'bytes');
                if (e.data.size > 0) {
                    audioChunks.push(e.data);
                }
            };
            
            mediaRecorder.onstop = function() {
                console.log('Recording stopped, chunks:', audioChunks.length);
                if (audioChunks.length > 0 && recordingStartTime) {
                    var mimeType = mediaRecorder.mimeType || 'audio/webm';
                    var blob = new Blob(audioChunks, { type: mimeType });
                    var duree = (Date.now() - recordingStartTime) / 1000;
                    console.log('Blob créé:', blob.size, 'bytes, durée:', duree, 's');
                    
                    if (duree >= 0.5) {
                        envoyerAudio(blob, duree);
                    } else {
                        showToast('Enregistrement trop court', 'warning');
                    }
                }
                audioChunks = [];
                recordingStartTime = null;
            };
            
            mediaRecorder.onerror = function(e) {
                console.error('MediaRecorder error:', e);
                showToast('Erreur d\'enregistrement', 'danger');
            };
            
            return true;
        })
        .catch(function(err) {
            console.error('Erreur micro:', err);
            showToast('Accès micro refusé: ' + err.message, 'danger');
            return false;
        });
    }

    function startRecording() {
        if (!mediaRecorder) {
            showToast('Micro non initialisé', 'danger');
            return;
        }
        
        if (mediaRecorder.state === 'recording') {
            console.log('Déjà en enregistrement');
            return;
        }
        
        audioChunks = [];
        recordingStartTime = Date.now();
        isRecording = true;
        
        try {
            mediaRecorder.start(100); // Collecter les données toutes les 100ms
            console.log('Enregistrement démarré');
            
            $('#recording-status').removeClass('d-none');
            $('#btn-start-recording').addClass('d-none');
            $('#btn-stop-recording').removeClass('d-none');
            $('#recording-time').text('0:00');
            
            recordingTimer = setInterval(function() {
                var sec = (Date.now() - recordingStartTime) / 1000;
                $('#recording-time').text(formatDuration(sec));
                if (sec >= 60) stopRecording();
            }, 100);
        } catch (err) {
            console.error('Erreur démarrage:', err);
            showToast('Erreur démarrage enregistrement', 'danger');
        }
    }

    function stopRecording() {
        console.log('Stop recording, state:', mediaRecorder ? mediaRecorder.state : 'null');
        
        if (!mediaRecorder || mediaRecorder.state !== 'recording') {
            return;
        }
        
        isRecording = false;
        clearInterval(recordingTimer);
        
        try {
            mediaRecorder.stop();
            console.log('MediaRecorder.stop() appelé');
        } catch (err) {
            console.error('Erreur stop:', err);
        }
        
        $('#recording-status').addClass('d-none');
        $('#btn-start-recording').removeClass('d-none');
        $('#btn-stop-recording').addClass('d-none');
        
        var modal = bootstrap.Modal.getInstance(document.getElementById('voiceModal'));
        if (modal) modal.hide();
    }

    function cancelRecording() {
        console.log('Cancel recording');
        audioChunks = [];
        recordingStartTime = null;
        isRecording = false;
        
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            try {
                mediaRecorder.stop();
            } catch (err) {
                console.error('Erreur cancel:', err);
            }
        }
        
        clearInterval(recordingTimer);
        $('#recording-status').addClass('d-none');
        $('#btn-start-recording').removeClass('d-none');
        $('#btn-stop-recording').addClass('d-none');
    }

    function envoyerAudio(blob, duree) {
        showToast('Envoi audio...', 'info');
        console.log('Envoi audio, taille:', blob.size, 'durée:', duree);
        
        var reader = new FileReader();
        reader.onloadend = function() {
            console.log('Audio encodé en base64');
            
            $.ajax({
                url: '/api/salon/' + salonId + '/audio/',
                method: 'POST',
                contentType: 'application/json',
                headers: { 'X-CSRFToken': csrfToken },
                data: JSON.stringify({ audio: reader.result, duree: duree }),
                success: function(res) {
                    console.log('Réponse serveur:', res);
                    if (res.success && res.message) {
                        showToast('Audio envoyé !', 'success');
                        appendMessage({
                            id: res.message.id,
                            type: 'audio',
                            audio_url: res.message.audio_url,
                            duree: res.message.duree,
                            auteur: res.message.auteur,
                            auteur_id: res.message.auteur_id,
                            date_envoi: res.message.date_envoi
                        }, true, false);
                        
                        if (res.message.id > lastMessageId) {
                            lastMessageId = res.message.id;
                        }
                    } else {
                        showToast(res.error || 'Erreur', 'danger');
                    }
                },
                error: function(xhr) {
                    console.error('Erreur envoi:', xhr);
                    var err = 'Erreur envoi audio';
                    if (xhr.responseJSON && xhr.responseJSON.error) {
                        err = xhr.responseJSON.error;
                    }
                    showToast(err, 'danger');
                }
            });
        };
        reader.onerror = function(err) {
            console.error('Erreur FileReader:', err);
            showToast('Erreur lecture audio', 'danger');
        };
        reader.readAsDataURL(blob);
    }

    function playAudio(btn) {
        var container = btn.closest('.audio-message');
        var audio = container.find('audio')[0];
        var progress = container.find('.audio-progress');
        var icon = btn.find('i');
        
        if (!audio) {
            showToast('Audio non trouvé', 'warning');
            return;
        }
        
        console.log('Play audio, src:', audio.src, 'paused:', audio.paused);
        
        // Pause tous les autres audios
        $('.audio-message audio').each(function() {
            if (this !== audio && !this.paused) {
                this.pause();
                this.currentTime = 0;
                $(this).closest('.audio-message').find('.btn-play-audio i')
                    .removeClass('bi-pause-fill').addClass('bi-play-fill');
                $(this).closest('.audio-message').find('.audio-progress').css('width', '0%');
            }
        });
        
        if (audio.paused) {
            // Recharger si nécessaire
            if (audio.readyState < 2) {
                audio.load();
            }
            
            var playPromise = audio.play();
            
            if (playPromise !== undefined) {
                playPromise.then(function() {
                    console.log('Lecture démarrée');
                    icon.removeClass('bi-play-fill').addClass('bi-pause-fill');
                }).catch(function(error) {
                    console.error('Erreur lecture:', error);
                    showToast('Erreur de lecture: ' + error.message, 'danger');
                });
            }
            
            audio.ontimeupdate = function() {
                if (audio.duration && !isNaN(audio.duration)) {
                    var pct = (audio.currentTime / audio.duration) * 100;
                    progress.css('width', pct + '%');
                }
            };
            
            audio.onended = function() {
                console.log('Lecture terminée');
                icon.removeClass('bi-pause-fill').addClass('bi-play-fill');
                progress.css('width', '0%');
            };
            
            audio.onerror = function(e) {
                console.error('Erreur audio:', e);
                showToast('Erreur de lecture audio', 'danger');
            };
        } else {
            audio.pause();
            icon.removeClass('bi-pause-fill').addClass('bi-play-fill');
        }
    }

    function startPolling() {
        refreshInterval = setInterval(chargerMessages, 2000);
    }

    // ==================
    // Event Listeners
    // ==================

    messageForm.on('submit', function(e) {
        e.preventDefault();
        envoyerMessage(messageInput.val().trim());
    });

    emojiBtn.on('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        emojiPicker.toggleClass('show');
    });

    $(document).on('click', '.emoji-item', function() {
        messageInput.val(messageInput.val() + $(this).data('emoji'));
        emojiPicker.removeClass('show');
        messageInput.focus();
    });

    $(document).on('click', function(e) {
        if (!$(e.target).closest('#emoji-picker, #emoji-btn').length) {
            emojiPicker.removeClass('show');
        }
    });

    voiceBtn.on('click', function() {
        if (!mediaRecorder) {
            initAudio().then(function(ok) {
                if (ok) {
                    var modal = new bootstrap.Modal(document.getElementById('voiceModal'));
                    modal.show();
                }
            });
        } else {
            var modal = new bootstrap.Modal(document.getElementById('voiceModal'));
            modal.show();
        }
    });

    $(document).on('click', '#btn-start-recording', startRecording);
    $(document).on('click', '#btn-stop-recording', stopRecording);
    $(document).on('click', '#btn-cancel-recording', function() {
        cancelRecording();
        var modal = bootstrap.Modal.getInstance(document.getElementById('voiceModal'));
        if (modal) modal.hide();
    });

    $('#voiceModal').on('hidden.bs.modal', function() {
        if (isRecording) {
            cancelRecording();
        }
    });

    $(document).on('click', '.btn-play-audio', function(e) {
        e.preventDefault();
        playAudio($(this));
    });

    $(document).on('click', '.btn-delete-msg', function(e) {
        e.preventDefault();
        e.stopPropagation();
        var msgId = $(this).data('msg-id');
        if (msgId) supprimerMessage(msgId);
    });

    // Modération
    $(document).on('click', '.btn-role', function(e) {
        e.preventDefault();
        var uid = $(this).data('user-id');
        var role = $(this).data('role');
        $.ajax({
            url: '/api/salon/' + salonId + '/membre/' + uid + '/role/',
            method: 'POST',
            contentType: 'application/json',
            headers: { 'X-CSRFToken': csrfToken },
            data: JSON.stringify({ role: role }),
            success: function(res) {
                if (res.success) {
                    showToast(res.message, 'success');
                    setTimeout(function() { location.reload(); }, 1000);
                }
            },
            error: function(xhr) {
                showToast(xhr.responseJSON ? xhr.responseJSON.error : 'Erreur', 'danger');
            }
        });
    });

    $(document).on('click', '.btn-ban', function(e) {
        e.preventDefault();
        var uid = $(this).data('user-id');
        $.ajax({
            url: '/api/salon/' + salonId + '/membre/' + uid + '/bannir/',
            method: 'POST',
            contentType: 'application/json',
            headers: { 'X-CSRFToken': csrfToken },
            data: JSON.stringify({ action: 'ban' }),
            success: function(res) {
                if (res.success) {
                    showToast(res.message, 'success');
                    setTimeout(function() { location.reload(); }, 1000);
                }
            }
        });
    });

    $(document).on('click', '.btn-unban', function(e) {
        e.preventDefault();
        var uid = $(this).data('user-id');
        $.ajax({
            url: '/api/salon/' + salonId + '/membre/' + uid + '/bannir/',
            method: 'POST',
            contentType: 'application/json',
            headers: { 'X-CSRFToken': csrfToken },
            data: JSON.stringify({ action: 'unban' }),
            success: function(res) {
                if (res.success) {
                    showToast(res.message, 'success');
                    setTimeout(function() { location.reload(); }, 1000);
                }
            }
        });
    });

    $(document).on('click', '.btn-kick', function(e) {
        e.preventDefault();
        if (!confirm('Expulser ?')) return;
        var uid = $(this).data('user-id');
        $.ajax({
            url: '/api/salon/' + salonId + '/membre/' + uid + '/expulser/',
            method: 'POST',
            headers: { 'X-CSRFToken': csrfToken },
            success: function(res) {
                if (res.success) {
                    showToast(res.message, 'success');
                    setTimeout(function() { location.reload(); }, 1000);
                }
            }
        });
    });

    $('#btn-invite-confirm').on('click', function() {
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
            error: function(xhr) {
                showToast(xhr.responseJSON ? xhr.responseJSON.error : 'Erreur', 'danger');
            }
        });
    });

    $('#btn-show-sidebar').on('click', function() { 
        $('#sidebar-mobile, #sidebar-overlay').addClass('show'); 
    });
    $('#btn-close-sidebar, #sidebar-overlay').on('click', function() { 
        $('#sidebar-mobile, #sidebar-overlay').removeClass('show'); 
    });

    $(window).on('beforeunload', function() {
        clearInterval(refreshInterval);
        if (isRecording) cancelRecording();
        if (audioStream) {
            audioStream.getTracks().forEach(function(track) {
                track.stop();
            });
        }
    });
});