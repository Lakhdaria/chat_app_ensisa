import json, os, uuid, base64

from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import login, logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.contrib import messages
from django.http import JsonResponse
from django.views.decorators.http import require_POST, require_GET
from django.core.files.base import ContentFile
from django.conf import settings

from .forms import InscriptionForm, ConnexionForm, SalonForm
from .models import Salon, Membership, Message, SalonMasque



######## INSCRIPTION / CONNEXION ########

def inscription(request):
    if request.user.is_authenticated:
        return redirect('home')
    
    form = InscriptionForm()
    if request.method == 'POST':
        form = InscriptionForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            messages.success(request, 'Inscription réussie ! Bienvenue !')
            return redirect('home')
    
    return render(request, 'chat/inscription.html', {'form': form})


def connexion(request):
    if request.user.is_authenticated:
        return redirect('home')
    
    form = ConnexionForm()
    if request.method == 'POST':
        form = ConnexionForm(request, data=request.POST)
        if form.is_valid():
            user = form.get_user()
            login(request, user)
            messages.success(request, 'Bienvenue ' + user.username + ' !')
            return redirect('home')
    
    return render(request, 'chat/connexion.html', {'form': form})


def deconnexion(request):
    logout(request)
    messages.info(request, 'Vous avez été déconnecté.')
    return redirect('connexion')



######## PAGE D'ACCUEIL ########

@login_required
def home(request):
    user = request.user
    
    # je recup les ids des salons que l'user a masqué
    salons_masques_ids = list(SalonMasque.objects.filter(user=user).values_list('salon_id', flat=True))
    
    # salons publics (j'exclue ceux masqués)
    salons_publics = Salon.objects.filter(est_prive=False)
    if len(salons_masques_ids) > 0:
        salons_publics = salons_publics.exclude(id__in=salons_masques_ids)
    
    # mes salons ou je suis membre
    mes_salons = Salon.objects.filter(memberships__user=user, memberships__est_banni=False).distinct()
    if len(salons_masques_ids) > 0:
        mes_salons = mes_salons.exclude(id__in=salons_masques_ids)
    
    # les salons masqués (pour pouvoir les réafficher)
    salons_masques = []
    if len(salons_masques_ids) > 0:
        salons_masques = Salon.objects.filter(id__in=salons_masques_ids)
    
    # si superuser il voit tout
    tous_salons = None
    if user.is_superuser:
        tous_salons = Salon.objects.all().select_related('createur')
    
    return render(request, 'chat/home.html', {
        'salons_publics': salons_publics,
        'mes_salons': mes_salons,
        'salons_masques': salons_masques,
        'tous_salons': tous_salons,
        'is_superuser': user.is_superuser,
    })



######## CREATION SALON ########

@login_required
def creer_salon(request):
    form = SalonForm()
    
    if request.method == 'POST':
        form = SalonForm(request.POST)
        if form.is_valid():
            salon = form.save(commit=False)
            salon.createur = request.user
            salon.save()
            
            # je cree le membership admin pour le createur
            Membership.objects.create(user=request.user, salon=salon, role='admin')
            
            messages.success(request, 'Salon "' + salon.nom + '" créé avec succès !')
            return redirect('salon', salon_id=salon.id)
    
    return render(request, 'chat/creer_salon.html', {'form': form})



######## VUE SALON ########

@login_required
def salon(request, salon_id):
    salon_obj = get_object_or_404(Salon, id=salon_id)
    
    # check si l'user est membre
    membership = Membership.objects.filter(user=request.user, salon=salon_obj).first()
    
    # acces interdit si prive et pas membre (sauf superuser)
    if salon_obj.est_prive == True and membership == None and request.user.is_superuser == False:
        messages.error(request, "Vous n'avez pas accès à ce salon privé.")
        return redirect('home')
    
    # si salon public et pas encore membre, on l'ajoute auto
    if membership == None and salon_obj.est_prive == False:
        membership = Membership.objects.create(user=request.user, salon=salon_obj, role='membre')
    
    # check si banni
    if membership != None and membership.est_banni == True and request.user.is_superuser == False:
        messages.error(request, "Vous avez été banni de ce salon.")
        return redirect('home')
    
    # recup les messages pas modérés
    messages_salon = salon_obj.messages.filter(est_modere=False).select_related('auteur')
    
    # liste des membres
    membres = Membership.objects.filter(salon=salon_obj).select_related('user')
    
    # droits
    is_admin = False
    is_modo = False
    if request.user.is_superuser:
        is_admin = True
        is_modo = True
    elif membership != None:
        if membership.role == 'admin':
            is_admin = True
            is_modo = True
        elif membership.role == 'moderateur':
            is_modo = True
    
    return render(request, 'chat/salon.html', {
        'salon': salon_obj,
        'messages_salon': messages_salon,
        'membres': membres,
        'membership': membership,
        'is_admin': is_admin,
        'is_modo': is_modo,
        'is_createur': salon_obj.createur == request.user,
        'is_superuser': request.user.is_superuser,
    })



######## REJOINDRE / QUITTER SALON ########

@login_required
def rejoindre_salon(request, salon_id):
    salon_obj = get_object_or_404(Salon, id=salon_id)
    
    if salon_obj.est_prive:
        messages.error(request, "Ce salon est privé.")
        return redirect('home')
    
    # get_or_create pour eviter les doublons
    membership, created = Membership.objects.get_or_create(
        user=request.user,
        salon=salon_obj,
        defaults={'role': 'membre'}
    )
    
    if membership.est_banni:
        messages.error(request, "Vous êtes banni de ce salon.")
        return redirect('home')
    
    if created:
        messages.success(request, 'Vous avez rejoint le salon "' + salon_obj.nom + '" !')
    
    return redirect('salon', salon_id=salon_obj.id)


@login_required
def quitter_salon(request, salon_id):
    salon_obj = get_object_or_404(Salon, id=salon_id)
    
    membership = Membership.objects.filter(user=request.user, salon=salon_obj).first()
    
    if membership != None:
        # empecher le createur de quitter
        if salon_obj.createur == request.user:
            messages.error(request, "Vous ne pouvez pas quitter un salon que vous avez créé.")
            return redirect('salon', salon_id=salon_obj.id)
        
        membership.delete()
        messages.info(request, 'Vous avez quitté le salon "' + salon_obj.nom + '".')
    
    return redirect('home')



######## API ENVOI MESSAGE TEXTE ########

@login_required
@require_POST
def envoyer_message(request, salon_id):
    salon_obj = get_object_or_404(Salon, id=salon_id)
    
    # verif membership
    membership = Membership.objects.filter(user=request.user, salon=salon_obj).first()
    if membership == None or membership.est_banni:
        return JsonResponse({'success': False, 'error': 'Accès refusé'}, status=403)
    
    # parse json
    try:
        data = json.loads(request.body)
    except:
        return JsonResponse({'success': False, 'error': 'Données invalides'}, status=400)
    
    contenu = data.get('contenu', '')
    contenu = contenu.strip()
    
    if contenu == '':
        return JsonResponse({'success': False, 'error': 'Message vide'}, status=400)
    
    # creation du message
    msg = Message.objects.create(
        contenu=contenu,
        type_message='text',
        auteur=request.user,
        salon=salon_obj
    )
    
    return JsonResponse({
        'success': True,
        'message': {
            'id': msg.id,
            'contenu': msg.contenu,
            'type': 'text',
            'auteur': msg.auteur.username,
            'auteur_id': msg.auteur.id,
            'date_envoi': msg.date_envoi.strftime('%H:%M')
        }
    })



######## API ENVOI AUDIO ########

@login_required
@require_POST
def envoyer_audio(request, salon_id):
    salon_obj = get_object_or_404(Salon, id=salon_id)
    
    membership = Membership.objects.filter(user=request.user, salon=salon_obj).first()
    if membership == None or membership.est_banni:
        return JsonResponse({'success': False, 'error': 'Accès refusé'}, status=403)
    
    try:
        data = json.loads(request.body)
    except:
        return JsonResponse({'success': False, 'error': 'JSON invalide'}, status=400)
    
    audio_data = data.get('audio', '')
    duree = data.get('duree', 0)
    
    if audio_data == '' or ',' not in audio_data:
        return JsonResponse({'success': False, 'error': 'Audio invalide'}, status=400)
    
    # je decode le base64
    try:
        parts = audio_data.split(',', 1)
        header = parts[0]
        b64 = parts[1]
        audio_bytes = base64.b64decode(b64)
    except Exception as err:
        return JsonResponse({'success': False, 'error': 'Erreur décodage: ' + str(err)}, status=400)
    
    # dossier pour les audios
    audio_dir = os.path.join(settings.MEDIA_ROOT, 'audio', 'salon_' + str(salon_id))
    if not os.path.exists(audio_dir):
        os.makedirs(audio_dir)
    
    msg = Message.objects.create(
        type_message='audio',
        duree_audio=duree,
        auteur=request.user,
        salon=salon_obj
    )
    
    # nom fichier unique
    filename = 'audio_' + uuid.uuid4().hex + '.webm'
    msg.fichier_audio.save(filename, ContentFile(audio_bytes))
    
    return JsonResponse({
        'success': True,
        'message': {
            'id': msg.id,
            'type': 'audio',
            'audio_url': msg.fichier_audio.url,
            'duree': msg.duree_audio,
            'auteur': msg.auteur.username,
            'auteur_id': msg.auteur.id,
            'date_envoi': msg.date_envoi.strftime('%H:%M')
        }
    })



######## API ENVOI IMAGE ########

@login_required
@require_POST
def envoyer_image(request, salon_id):
    salon_obj = get_object_or_404(Salon, id=salon_id)
    
    membership = Membership.objects.filter(user=request.user, salon=salon_obj).first()
    if membership == None or membership.est_banni:
        return JsonResponse({'success': False, 'error': 'Accès refusé'}, status=403)
    
    try:
        data = json.loads(request.body)
    except:
        return JsonResponse({'success': False, 'error': 'JSON invalide'}, status=400)
    
    image_data = data.get('image', '')
    
    if image_data == '' or ',' not in image_data:
        return JsonResponse({'success': False, 'error': 'Image invalide'}, status=400)
    
    try:
        parts = image_data.split(',', 1)
        header = parts[0]
        b64 = parts[1]
        image_bytes = base64.b64decode(b64)
        
        # trouver l'extension
        ext = 'jpg'  # par defaut
        if 'png' in header:
            ext = 'png'
        elif 'gif' in header:
            ext = 'gif'
        elif 'webp' in header:
            ext = 'webp'
    except Exception as err:
        return JsonResponse({'success': False, 'error': 'Erreur: ' + str(err)}, status=400)
    
    # dossier images
    image_dir = os.path.join(settings.MEDIA_ROOT, 'images', 'salon_' + str(salon_id))
    if not os.path.exists(image_dir):
        os.makedirs(image_dir)
    
    msg = Message.objects.create(
        type_message='image',
        auteur=request.user,
        salon=salon_obj
    )
    
    filename = 'image_' + uuid.uuid4().hex + '.' + ext
    msg.fichier_image.save(filename, ContentFile(image_bytes))
    
    return JsonResponse({
        'success': True,
        'message': {
            'id': msg.id,
            'type': 'image',
            'image_url': msg.fichier_image.url,
            'auteur': msg.auteur.username,
            'auteur_id': msg.auteur.id,
            'date_envoi': msg.date_envoi.strftime('%H:%M')
        }
    })



######## API CHARGER MESSAGES (polling) ########

@login_required
@require_GET
def charger_messages(request, salon_id):
    salon_obj = get_object_or_404(Salon, id=salon_id)
    
    membership = Membership.objects.filter(user=request.user, salon=salon_obj).first()
    if membership == None or membership.est_banni:
        return JsonResponse({'success': False, 'error': 'Accès refusé'}, status=403)
    
    # recup le last_id depuis les params GET
    last_id = request.GET.get('last_id', 0)
    try:
        last_id = int(last_id)
    except:
        last_id = 0
    
    # messages plus recents que last_id
    messages_qs = salon_obj.messages.filter(est_modere=False, id__gt=last_id)
    messages_qs = messages_qs.select_related('auteur').order_by('date_envoi')
    
    # construire la liste
    messages_list = []
    for m in messages_qs:
        msg_data = {
            'id': m.id,
            'type': m.type_message,
            'auteur': m.auteur.username,
            'auteur_id': m.auteur.id,
            'date_envoi': m.date_envoi.strftime('%H:%M')
        }
        
        if m.type_message == 'text':
            msg_data['contenu'] = m.contenu if m.contenu else ''
        elif m.type_message == 'audio':
            msg_data['audio_url'] = m.fichier_audio.url if m.fichier_audio else ''
            msg_data['duree'] = m.duree_audio if m.duree_audio else 0
        elif m.type_message == 'image':
            msg_data['image_url'] = m.fichier_image.url if m.fichier_image else ''
        
        messages_list.append(msg_data)
    
    return JsonResponse({
        'success': True,
        'messages': messages_list,
        'user_id': request.user.id
    })



######## API SUPPRIMER MESSAGE ########

@login_required
@require_POST
def supprimer_message(request, salon_id, message_id):
    salon_obj = get_object_or_404(Salon, id=salon_id)
    msg = get_object_or_404(Message, id=message_id, salon=salon_obj)
    
    membership = Membership.objects.filter(user=request.user, salon=salon_obj).first()
    
    # verif permissions
    can_delete = False
    if request.user.is_superuser:
        can_delete = True
    elif msg.auteur == request.user:
        can_delete = True
    elif membership != None and membership.role in ['admin', 'moderateur']:
        can_delete = True
    
    if can_delete == False:
        return JsonResponse({'success': False, 'error': 'Permission refusée'}, status=403)
    
    # supprimer le fichier si y'en a un
    if msg.type_message == 'audio' and msg.fichier_audio:
        try:
            filepath = msg.fichier_audio.path
            if filepath and os.path.isfile(filepath):
                os.remove(filepath)
        except:
            pass  # tant pis si ca marche pas
    
    if msg.type_message == 'image' and msg.fichier_image:
        try:
            filepath = msg.fichier_image.path
            if filepath and os.path.isfile(filepath):
                os.remove(filepath)
        except:
            pass
    
    msg.est_modere = True
    msg.save()
    
    return JsonResponse({'success': True, 'message': 'Message supprimé'})



######## API CHANGER ROLE ########

@login_required
@require_POST
def changer_role(request, salon_id, user_id):
    salon_obj = get_object_or_404(Salon, id=salon_id)
    target_user = get_object_or_404(User, id=user_id)
    
    membership = Membership.objects.filter(user=request.user, salon=salon_obj).first()
    
    # faut etre admin ou superuser
    is_admin = request.user.is_superuser or (membership != None and membership.role == 'admin')
    if is_admin == False:
        return JsonResponse({'success': False, 'error': 'Permission refusée'}, status=403)
    
    target_membership = Membership.objects.filter(user=target_user, salon=salon_obj).first()
    if target_membership == None:
        return JsonResponse({'success': False, 'error': 'Utilisateur non membre'}, status=404)
    
    # on peut pas modifier le createur sauf si superuser
    if target_user == salon_obj.createur and request.user.is_superuser == False:
        return JsonResponse({'success': False, 'error': 'Impossible de modifier le créateur'}, status=403)
    
    try:
        data = json.loads(request.body)
    except:
        return JsonResponse({'success': False, 'error': 'Données invalides'}, status=400)
    
    new_role = data.get('role', '').strip()
    
    roles_valides = ['membre', 'moderateur', 'admin']
    if new_role not in roles_valides:
        return JsonResponse({'success': False, 'error': 'Rôle invalide'}, status=400)
    
    target_membership.role = new_role
    target_membership.save()
    
    return JsonResponse({
        'success': True,
        'message': target_user.username + ' est maintenant ' + new_role,
        'role': new_role
    })



######## API BANNIR MEMBRE ########

@login_required
@require_POST
def bannir_membre(request, salon_id, user_id):
    salon_obj = get_object_or_404(Salon, id=salon_id)
    target_user = get_object_or_404(User, id=user_id)
    
    membership = Membership.objects.filter(user=request.user, salon=salon_obj).first()
    
    # faut etre modo ou admin
    is_modo = request.user.is_superuser or (membership != None and membership.role in ['admin', 'moderateur'])
    if is_modo == False:
        return JsonResponse({'success': False, 'error': 'Permission refusée'}, status=403)
    
    target_membership = Membership.objects.filter(user=target_user, salon=salon_obj).first()
    if target_membership == None:
        return JsonResponse({'success': False, 'error': 'Utilisateur non membre'}, status=404)
    
    # protection createur
    if target_user == salon_obj.createur and request.user.is_superuser == False:
        return JsonResponse({'success': False, 'error': 'Impossible de bannir le créateur'}, status=403)
    
    # modo peut pas ban admin
    if membership != None and membership.role == 'moderateur':
        if target_membership.role == 'admin' and request.user.is_superuser == False:
            return JsonResponse({'success': False, 'error': 'Impossible de bannir un admin'}, status=403)
    
    try:
        data = json.loads(request.body)
    except:
        return JsonResponse({'success': False, 'error': 'Données invalides'}, status=400)
    
    action = data.get('action', 'ban')
    
    if action == 'ban':
        target_membership.est_banni = True
        result_msg = target_user.username + ' a été banni'
    else:
        target_membership.est_banni = False
        result_msg = target_user.username + ' a été débanni'
    
    target_membership.save()
    
    return JsonResponse({
        'success': True,
        'message': result_msg,
        'est_banni': target_membership.est_banni
    })



######## API INVITER MEMBRE ########

@login_required
@require_POST
def inviter_membre(request, salon_id):
    salon_obj = get_object_or_404(Salon, id=salon_id)
    
    membership = Membership.objects.filter(user=request.user, salon=salon_obj).first()
    
    # seulement admin peut inviter
    if membership == None or membership.role != 'admin':
        return JsonResponse({'success': False, 'error': 'Permission refusée'}, status=403)
    
    try:
        data = json.loads(request.body)
    except:
        return JsonResponse({'success': False, 'error': 'Données invalides'}, status=400)
    
    username = data.get('username', '').strip()
    
    if username == '':
        return JsonResponse({'success': False, 'error': "Nom d'utilisateur requis"}, status=400)
    
    # chercher l'user (case insensitive)
    target_user = User.objects.filter(username__iexact=username).first()
    if target_user == None:
        return JsonResponse({'success': False, 'error': 'Utilisateur non trouvé'}, status=404)
    
    # verif si deja membre
    existing = Membership.objects.filter(user=target_user, salon=salon_obj).first()
    if existing != None:
        if existing.est_banni:
            return JsonResponse({'success': False, 'error': 'Cet utilisateur est banni'}, status=400)
        else:
            return JsonResponse({'success': False, 'error': 'Déjà membre du salon'}, status=400)
    
    Membership.objects.create(user=target_user, salon=salon_obj, role='membre')
    
    return JsonResponse({
        'success': True,
        'message': target_user.username + ' a été invité',
        'user': {
            'id': target_user.id,
            'username': target_user.username
        }
    })



######## API EXPULSER MEMBRE ########

@login_required
@require_POST
def expulser_membre(request, salon_id, user_id):
    salon_obj = get_object_or_404(Salon, id=salon_id)
    target_user = get_object_or_404(User, id=user_id)
    
    membership = Membership.objects.filter(user=request.user, salon=salon_obj).first()
    
    is_admin = request.user.is_superuser or (membership != None and membership.role == 'admin')
    if is_admin == False:
        return JsonResponse({'success': False, 'error': 'Permission refusée'}, status=403)
    
    target_membership = Membership.objects.filter(user=target_user, salon=salon_obj).first()
    if target_membership == None:
        return JsonResponse({'success': False, 'error': 'Utilisateur non membre'}, status=404)
    
    if target_user == salon_obj.createur and request.user.is_superuser == False:
        return JsonResponse({'success': False, 'error': "Impossible d'expulser le créateur"}, status=403)
    
    target_membership.delete()
    
    return JsonResponse({
        'success': True,
        'message': target_user.username + ' a été expulsé'
    })



######## API GET MEMBRES ########

@login_required
@require_GET
def get_membres(request, salon_id):
    salon_obj = get_object_or_404(Salon, id=salon_id)
    
    membership = Membership.objects.filter(user=request.user, salon=salon_obj).first()
    if membership == None or membership.est_banni:
        return JsonResponse({'success': False, 'error': 'Accès refusé'}, status=403)
    
    membres = Membership.objects.filter(salon=salon_obj).select_related('user')
    
    result = []
    for m in membres:
        result.append({
            'id': m.user.id,
            'username': m.user.username,
            'role': m.role,
            'est_banni': m.est_banni,
            'is_createur': m.user == salon_obj.createur
        })
    
    return JsonResponse({
        'success': True,
        'membres': result
    })



######## API MASQUER / AFFICHER SALON ########

@login_required
@require_POST
def masquer_salon(request, salon_id):
    salon_obj = get_object_or_404(Salon, id=salon_id)
    
    obj, created = SalonMasque.objects.get_or_create(user=request.user, salon=salon_obj)
    
    msg = 'Le salon "' + salon_obj.nom + '" a été masqué'
    if created == False:
        msg = 'Ce salon est déjà masqué'
    
    return JsonResponse({'success': True, 'message': msg})


@login_required
@require_POST
def afficher_salon(request, salon_id):
    salon_obj = get_object_or_404(Salon, id=salon_id)
    
    SalonMasque.objects.filter(user=request.user, salon=salon_obj).delete()
    
    return JsonResponse({
        'success': True,
        'message': 'Le salon "' + salon_obj.nom + '" est à nouveau visible'
    })



######## API SUPPRIMER SALON ########

@login_required
@require_POST
def supprimer_salon(request, salon_id):
    salon_obj = get_object_or_404(Salon, id=salon_id)
    
    # verif droits
    if salon_obj.createur != request.user and request.user.is_superuser == False:
        return JsonResponse({
            'success': False,
            'error': 'Seul le créateur ou un administrateur peut supprimer ce salon'
        }, status=403)
    
    nom_salon = salon_obj.nom
    
    # supprimer les fichiers des messages avant de delete le salon
    for msg in salon_obj.messages.all():
        if msg.type_message == 'audio' and msg.fichier_audio:
            try:
                if os.path.isfile(msg.fichier_audio.path):
                    os.remove(msg.fichier_audio.path)
            except:
                pass
        
        if msg.type_message == 'image' and msg.fichier_image:
            try:
                if os.path.isfile(msg.fichier_image.path):
                    os.remove(msg.fichier_image.path)
            except:
                pass
    
    salon_obj.delete()
    
    return JsonResponse({
        'success': True,
        'message': 'Le salon "' + nom_salon + '" a été supprimé définitivement'
    })
