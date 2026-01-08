/**
 * Chat Application - JavaScript Client
 * Compatible avec les URLs de views.py
 */

$(document).ready(function() {
    // Éléments DOM
    var chatMessages = $('#chat-messages');
    var messageForm = $('#message-form');
    var messageInput = $('#message-input');
    
    // Données du salon
    var salonId = chatMessages.data('salon-id');
    var userId = chatMessages.data('user-id');
    var username = chatMessages.data('username');
    var isModo = chatMessages.data('is-modo') === 'true' || chatMessages.data('is-modo') === true || chatMessages.data('is-modo') === 'True';
    var isAdmin = chatMessages.data('is-admin') === 'true' || chatMessages.data('is-admin') === true || chatMessages.data('is-admin') === 'True';
    var csrfToken = $('input[name="csrfmiddlewaretoken"]').val();
    
    // Variables
    var lastMessageId = 0;
    var refreshInterval;
    
    // Audio
    var mediaRecorder = null;
    var audioChunks = [];
    var recordingTimer = null;
    var recordingSeconds = 0;
    
    // Caméra
    var cameraStream = null;

    // ==========================================
    // INITIALISATION
    // ==========================================
    
    function init() {
        initLastMessageId();
        scrollToBottom();
        startPolling();
        messageInput.focus();
        console.log('Chat initialisé - Salon:', salonId, '- User:', userId, '- Admin:', isAdmin, '- Modo:', isModo);
    }
    
    function initLastMessageId() {
        chatMessages.find('.message').each(function() {
            var id = parseInt($(this).data('id')) || 0;
            if (id > lastMessageId) lastMessageId = id;
        });
        console.log('Last message ID:', lastMessageId);
    }
    
    function scrollToBottom() {
        chatMessages.scrollTop(chatMessages[0].scrollHeight);
    }
    
    // ==========================================
    // POLLING - Récupération des nouveaux messages
    // ==========================================
    
    function startPolling() {
        refreshInterval = setInterval(fetchNewMessages, 3000);
    }
    
    function fetchNewMessages() {
        $.ajax({
            url: '/api/salon/' + salonId + '/messages/',
            method: 'GET',
            data: { last_id: lastMessageId },
            success: function(res) {
                if (res.success && res.messages && res.messages.length > 0) {
                    res.messages.forEach(function(msg) {
                        if (msg.id > lastMessageId && msg.auteur_id != userId) {
                            appendMessage(msg);
                            lastMessageId = msg.id;
                        }
                    });
                    scrollToBottom();
                    $('#no-messages').hide();
                }
            },
            error: function(err) {
                console.log('Erreur polling:', err);
            }
        });
    }
    
    // ==========================================
    // ENVOI DE MESSAGES TEXTE
    // ==========================================
    
    messageForm.on('submit', function(e) {
        e.preventDefault();
        var contenu = messageInput.val().trim();
        if (!contenu) return;
        
        $.ajax({
            url: '/api/salon/' + salonId + '/envoyer/',
            method: 'POST',
            headers: { 'X-CSRFToken': csrfToken },
            contentType: 'application/json',
            data: JSON.stringify({ contenu: contenu }),
            success: function(res) {
                if (res.success) {
                    messageInput.val('');
                    appendMessage(res.message);
                    if (res.message.id > lastMessageId) {
                        lastMessageId = res.message.id;
                    }
                    scrollToBottom();
                    $('#no-messages').hide();
                }
            },
            error: function(xhr) {
                var error = xhr.responseJSON ? xhr.responseJSON.error : 'Erreur d\'envoi';
                showToast(error, 'danger');
            }
        });
    });
    
    // ==========================================
    // AFFICHAGE DES MESSAGES
    // ==========================================
    
    function appendMessage(msg) {
        var isOwn = msg.auteur_id == userId;
        var html = '<div class="message ' + (isOwn ? 'message-own' : '') + '" data-id="' + msg.id + '">';
        html += '<div class="d-flex align-items-center justify-content-between">';
        html += '<div><span class="message-author">' + escapeHtml(msg.auteur) + '</span>';
        html += '<span class="message-time">' + msg.date_envoi + '</span></div>';
        
        // Bouton supprimer
        if (isOwn || isModo || isAdmin) {
            html += '<button class="btn btn-link btn-sm btn-delete-msg text-danger p-0" data-msg-id="' + msg.id + '">';
            html += '<i class="bi bi-trash"></i></button>';
        }
        html += '</div>';
        
        // Contenu selon le type
        if (msg.type === 'text' && msg.contenu) {
            html += '<div class="message-content">' + escapeHtml(msg.contenu) + '</div>';
        }
        
        if (msg.type === 'image' && msg.image_url) {
            html += '<div class="message-image-container">';
            html += '<img src="' + msg.image_url + '" alt="Image" class="message-image" onclick="openImageModal(\'' + msg.image_url + '\')">';
            html += '</div>';
        }
        
        if (msg.type === 'audio' && msg.audio_url) {
            html += '<div class="message-audio">';
            html += '<audio controls><source src="' + msg.audio_url + '" type="audio/webm"></audio>';
            if (msg.duree) {
                html += '<small class="text-muted ms-2">' + Math.round(msg.duree) + 's</small>';
            }
            html += '</div>';
        }
        
        html += '</div>';
        chatMessages.append(html);
    }
    
    function escapeHtml(text) {
        if (!text) return '';
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // ==========================================
    // SUPPRESSION DE MESSAGES
    // ==========================================
    
    $(document).on('click', '.btn-delete-msg', function(e) {
        e.preventDefault();
        var msgId = $(this).data('msg-id');
        var msgElement = $(this).closest('.message');
        
        if (!confirm('Supprimer ce message ?')) return;
        
        $.ajax({
            url: '/api/salon/' + salonId + '/message/' + msgId + '/supprimer/',
            method: 'POST',
            headers: { 'X-CSRFToken': csrfToken },
            success: function(res) {
                if (res.success) {
                    msgElement.fadeOut(300, function() { $(this).remove(); });
                    showToast('Message supprimé', 'success');
                }
            },
            error: function(xhr) {
                var error = xhr.responseJSON ? xhr.responseJSON.error : 'Erreur';
                showToast(error, 'danger');
            }
        });
    });
    
    // ==========================================
    // EMOJIS
    // ==========================================
    
    $('#btn-emoji').on('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        $('#emoji-picker').toggleClass('show');
    });
    
    $(document).on('click', '.emoji-btn', function(e) {
        e.preventDefault();
        var emoji = $(this).text();
        var input = messageInput[0];
        var cursorPos = input.selectionStart || 0;
        var textBefore = messageInput.val().substring(0, cursorPos);
        var textAfter = messageInput.val().substring(cursorPos);
        messageInput.val(textBefore + emoji + textAfter);
        messageInput.focus();
        
        // Repositionner le curseur après l'emoji
        var newPos = cursorPos + emoji.length;
        input.setSelectionRange(newPos, newPos);
        
        $('#emoji-picker').removeClass('show');
    });
    
    // Fermer le picker en cliquant ailleurs
    $(document).on('click', function(e) {
        if (!$(e.target).closest('#emoji-picker, #btn-emoji').length) {
            $('#emoji-picker').removeClass('show');
        }
    });
    
    // ==========================================
    // UPLOAD D'IMAGES
    // ==========================================
    
    $('#btn-image').on('click', function(e) {
        e.preventDefault();
        $('#image-input').click();
    });
    
    $('#image-input').on('change', function() {
        var file = this.files[0];
        if (!file) return;
        
        if (!file.type.startsWith('image/')) {
            showToast('Veuillez sélectionner une image', 'warning');
            return;
        }
        
        if (file.size > 10 * 1024 * 1024) {
            showToast('Image trop grande (max 10MB)', 'warning');
            return;
        }
        
        showToast('Envoi de l\'image...', 'info');
        
        var reader = new FileReader();
        reader.onload = function(e) {
            envoyerImage(e.target.result);
        };
        reader.onerror = function() {
            showToast('Erreur de lecture du fichier', 'danger');
        };
        reader.readAsDataURL(file);
    });
    
    function envoyerImage(imageData) {
        $.ajax({
            url: '/api/salon/' + salonId + '/image/',
            method: 'POST',
            headers: { 'X-CSRFToken': csrfToken },
            contentType: 'application/json',
            data: JSON.stringify({ image: imageData }),
            success: function(res) {
                if (res.success) {
                    showToast('Image envoyée !', 'success');
                    appendMessage(res.message);
                    if (res.message.id > lastMessageId) {
                        lastMessageId = res.message.id;
                    }
                    scrollToBottom();
                    $('#image-input').val('');
                }
            },
            error: function(xhr) {
                var error = xhr.responseJSON ? xhr.responseJSON.error : 'Erreur d\'envoi';
                showToast(error, 'danger');
                console.log('Erreur image:', xhr.responseJSON);
            }
        });
    }
    
    // ==========================================
    // MESSAGES VOCAUX
    // ==========================================
    
    $('#btn-start-recording').on('click', function() {
        startRecording();
    });
    
    $('#btn-stop-recording').on('click', function() {
        stopRecording();
    });
    
    $('#btn-cancel-recording').on('click', function() {
        cancelRecording();
    });
    
    // Aussi annuler si on ferme le modal
    $('#voiceModal').on('hidden.bs.modal', function() {
        cancelRecording();
    });
    
    function startRecording() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            showToast('Votre navigateur ne supporte pas l\'enregistrement audio', 'danger');
            return;
        }
        
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(function(stream) {
                audioChunks = [];
                recordingSeconds = 0;
                
                // Trouver le meilleur format supporté
                var mimeType = 'audio/webm';
                if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
                    mimeType = 'audio/webm;codecs=opus';
                } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
                    mimeType = 'audio/ogg;codecs=opus';
                } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
                    mimeType = 'audio/mp4';
                }
                
                try {
                    mediaRecorder = new MediaRecorder(stream, { mimeType: mimeType });
                } catch (e) {
                    mediaRecorder = new MediaRecorder(stream);
                }
                
                mediaRecorder.ondataavailable = function(e) {
                    if (e.data.size > 0) {
                        audioChunks.push(e.data);
                    }
                };
                
                mediaRecorder.onstop = function() {
                    stream.getTracks().forEach(function(track) { track.stop(); });
                };
                
                mediaRecorder.start(100); // Collecter les données toutes les 100ms
                
                // UI
                $('#btn-start-recording').addClass('d-none');
                $('#btn-stop-recording').removeClass('d-none');
                $('#recording-status').removeClass('d-none');
                
                // Timer
                recordingTimer = setInterval(function() {
                    recordingSeconds++;
                    var mins = Math.floor(recordingSeconds / 60);
                    var secs = recordingSeconds % 60;
                    $('#recording-time').text(mins + ':' + (secs < 10 ? '0' : '') + secs);
                }, 1000);
                
                console.log('Enregistrement démarré avec:', mimeType);
            })
            .catch(function(err) {
                console.error('Erreur micro:', err);
                showToast('Impossible d\'accéder au microphone: ' + err.message, 'danger');
            });
    }
    
    function stopRecording() {
        if (!mediaRecorder || mediaRecorder.state === 'inactive') {
            console.log('MediaRecorder inactif');
            return;
        }
        
        clearInterval(recordingTimer);
        var duree = recordingSeconds;
        
        mediaRecorder.onstop = function() {
            var blob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
            console.log('Audio blob créé:', blob.size, 'bytes');
            envoyerAudio(blob, duree);
            resetRecordingUI();
            
            // Fermer le modal
            var modalEl = document.getElementById('voiceModal');
            var modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
        };
        
        mediaRecorder.stop();
    }
    
    function cancelRecording() {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
        clearInterval(recordingTimer);
        resetRecordingUI();
        audioChunks = [];
    }
    
    function resetRecordingUI() {
        $('#btn-start-recording').removeClass('d-none');
        $('#btn-stop-recording').addClass('d-none');
        $('#recording-status').addClass('d-none');
        $('#recording-time').text('0:00');
        recordingSeconds = 0;
    }
    
    function envoyerAudio(blob, duree) {
        showToast('Envoi du message vocal...', 'info');
        
        var reader = new FileReader();
        reader.onload = function() {
            var base64data = reader.result;
            console.log('Audio base64 length:', base64data.length);
            
            $.ajax({
                url: '/api/salon/' + salonId + '/audio/',
                method: 'POST',
                headers: { 'X-CSRFToken': csrfToken },
                contentType: 'application/json',
                data: JSON.stringify({ 
                    audio: base64data,
                    duree: duree
                }),
                success: function(res) {
                    if (res.success) {
                        showToast('Message vocal envoyé !', 'success');
                        appendMessage(res.message);
                        if (res.message.id > lastMessageId) {
                            lastMessageId = res.message.id;
                        }
                        scrollToBottom();
                    }
                },
                error: function(xhr) {
                    var error = xhr.responseJSON ? xhr.responseJSON.error : 'Erreur d\'envoi';
                    showToast(error, 'danger');
                    console.log('Erreur audio:', xhr.responseJSON);
                }
            });
        };
        reader.onerror = function() {
            showToast('Erreur de lecture audio', 'danger');
        };
        reader.readAsDataURL(blob);
    }
    
    // ==========================================
    // CAMÉRA
    // ==========================================
    
    $('#cameraModal').on('shown.bs.modal', function() {
        startCamera();
    });
    
    $('#cameraModal').on('hidden.bs.modal', function() {
        stopCamera();
    });
    
    function startCamera() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            showToast('Votre navigateur ne supporte pas la caméra', 'danger');
            return;
        }
        
        navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false 
        })
        .then(function(stream) {
            cameraStream = stream;
            var video = document.getElementById('camera-video');
            video.srcObject = stream;
            video.play();
            console.log('Caméra démarrée');
        })
        .catch(function(err) {
            console.error('Erreur caméra:', err);
            showToast('Impossible d\'accéder à la caméra: ' + err.message, 'danger');
        });
    }
    
    function stopCamera() {
        if (cameraStream) {
            cameraStream.getTracks().forEach(function(track) { 
                track.stop(); 
            });
            cameraStream = null;
        }
        var video = document.getElementById('camera-video');
        if (video) {
            video.srcObject = null;
        }
        console.log('Caméra arrêtée');
    }
    
    $('#btn-take-photo').on('click', function() {
        var video = document.getElementById('camera-video');
        var canvas = document.getElementById('camera-canvas');
        
        if (!video || !video.videoWidth) {
            showToast('La caméra n\'est pas prête', 'warning');
            return;
        }
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        var ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);
        
        var imageData = canvas.toDataURL('image/jpeg', 0.8);
        
        // Fermer le modal
        var modalEl = document.getElementById('cameraModal');
        var modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
        
        // Envoyer l'image
        showToast('Envoi de la photo...', 'info');
        envoyerImage(imageData);
    });
    
    // ==========================================
    // INVITATION (Salons privés)
    // ==========================================
    
    $('#btn-invite-confirm').on('click', function() {
        var inviteUsername = $('#invite-username').val().trim();
        if (!inviteUsername) {
            showToast('Entrez un nom d\'utilisateur', 'warning');
            return;
        }
        
        $.ajax({
            url: '/api/salon/' + salonId + '/inviter/',
            method: 'POST',
            headers: { 'X-CSRFToken': csrfToken },
            contentType: 'application/json',
            data: JSON.stringify({ username: inviteUsername }),
            success: function(res) {
                if (res.success) {
                    showToast(res.message, 'success');
                    $('#invite-username').val('');
                    var modalEl = document.getElementById('inviteModal');
                    var modal = bootstrap.Modal.getInstance(modalEl);
                    if (modal) modal.hide();
                    setTimeout(function() { location.reload(); }, 1000);
                }
            },
            error: function(xhr) {
                var error = xhr.responseJSON ? xhr.responseJSON.error : 'Erreur';
                showToast(error, 'danger');
            }
        });
    });
    
    // Permettre d'appuyer sur Entrée pour inviter
    $('#invite-username').on('keypress', function(e) {
        if (e.which === 13) {
            e.preventDefault();
            $('#btn-invite-confirm').click();
        }
    });
    
    // ==========================================
    // MODÉRATION
    // ==========================================
    
    // Changer le rôle
    $(document).on('click', '.btn-role', function(e) {
        e.preventDefault();
        var targetUserId = $(this).data('user-id');
        var role = $(this).data('role');
        
        $.ajax({
            url: '/api/salon/' + salonId + '/membre/' + targetUserId + '/role/',
            method: 'POST',
            headers: { 'X-CSRFToken': csrfToken },
            contentType: 'application/json',
            data: JSON.stringify({ role: role }),
            success: function(res) {
                if (res.success) {
                    showToast(res.message, 'success');
                    setTimeout(function() { location.reload(); }, 1000);
                }
            },
            error: function(xhr) {
                var error = xhr.responseJSON ? xhr.responseJSON.error : 'Erreur';
                showToast(error, 'danger');
            }
        });
    });
    
    // Bannir
    $(document).on('click', '.btn-ban', function(e) {
        e.preventDefault();
        var targetUserId = $(this).data('user-id');
        
        if (!confirm('Bannir ce membre ?')) return;
        
        $.ajax({
            url: '/api/salon/' + salonId + '/membre/' + targetUserId + '/bannir/',
            method: 'POST',
            headers: { 'X-CSRFToken': csrfToken },
            contentType: 'application/json',
            data: JSON.stringify({ action: 'ban' }),
            success: function(res) {
                if (res.success) {
                    showToast(res.message, 'success');
                    setTimeout(function() { location.reload(); }, 1000);
                }
            },
            error: function(xhr) {
                var error = xhr.responseJSON ? xhr.responseJSON.error : 'Erreur';
                showToast(error, 'danger');
            }
        });
    });
    
    // Débannir
    $(document).on('click', '.btn-unban', function(e) {
        e.preventDefault();
        var targetUserId = $(this).data('user-id');
        
        $.ajax({
            url: '/api/salon/' + salonId + '/membre/' + targetUserId + '/bannir/',
            method: 'POST',
            headers: { 'X-CSRFToken': csrfToken },
            contentType: 'application/json',
            data: JSON.stringify({ action: 'unban' }),
            success: function(res) {
                if (res.success) {
                    showToast(res.message, 'success');
                    setTimeout(function() { location.reload(); }, 1000);
                }
            },
            error: function(xhr) {
                var error = xhr.responseJSON ? xhr.responseJSON.error : 'Erreur';
                showToast(error, 'danger');
            }
        });
    });
    
    // Expulser
    $(document).on('click', '.btn-kick', function(e) {
        e.preventDefault();
        var targetUserId = $(this).data('user-id');
        
        if (!confirm('Expulser ce membre ?')) return;
        
        $.ajax({
            url: '/api/salon/' + salonId + '/membre/' + targetUserId + '/expulser/',
            method: 'POST',
            headers: { 'X-CSRFToken': csrfToken },
            success: function(res) {
                if (res.success) {
                    showToast(res.message, 'success');
                    setTimeout(function() { location.reload(); }, 1000);
                }
            },
            error: function(xhr) {
                var error = xhr.responseJSON ? xhr.responseJSON.error : 'Erreur';
                showToast(error, 'danger');
            }
        });
    });
    
    // ==========================================
    // UTILITAIRES
    // ==========================================
    
    function showToast(message, type) {
        type = type || 'info';
        var bgClass = 'bg-' + type;
        
        var html = '<div class="toast align-items-center text-white ' + bgClass + ' border-0" role="alert">' +
            '<div class="d-flex">' +
            '<div class="toast-body">' + escapeHtml(message) + '</div>' +
            '<button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>' +
            '</div></div>';
        
        var $toast = $(html);
        $('#toast-container').append($toast);
        
        var toast = new bootstrap.Toast($toast[0], { delay: 3000 });
        toast.show();
        
        $toast.on('hidden.bs.toast', function() {
            $(this).remove();
        });
    }
    
    // Nettoyage à la fermeture
    $(window).on('beforeunload', function() {
        clearInterval(refreshInterval);
        cancelRecording();
        stopCamera();
    });
    
    // ==========================================
    // DÉMARRAGE
    // ==========================================
    
    init();
});

// ==========================================
// FONCTIONS GLOBALES
// ==========================================

function openImageModal(src) {
    $('#modal-image').attr('src', src);
    $('#image-modal').addClass('show');
}