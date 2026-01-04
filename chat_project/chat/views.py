import json
import os
import uuid
import base64
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
from .models import Salon, Membership, Message


# =====================
# Vues d'authentification
# =====================

def inscription(request):
    """Vue pour l'inscription"""
    if request.user.is_authenticated:
        return redirect('home')
    
    if request.method == 'POST':
        form = InscriptionForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            messages.success(request, 'Inscription réussie ! Bienvenue !')
            return redirect('home')
    else:
        form = InscriptionForm()
    
    return render(request, 'chat/inscription.html', {'form': form})


def connexion(request):
    """Vue pour la connexion"""
    if request.user.is_authenticated:
        return redirect('home')
    
    if request.method == 'POST':
        form = ConnexionForm(request, data=request.POST)
        if form.is_valid():
            user = form.get_user()
            login(request, user)
            messages.success(request, f'Bienvenue {user.username} !')
            return redirect('home')
    else:
        form = ConnexionForm()
    
    return render(request, 'chat/connexion.html', {'form': form})


def deconnexion(request):
    """Vue pour la déconnexion"""
    logout(request)
    messages.info(request, 'Vous avez été déconnecté.')
    return redirect('connexion')


# =====================
# Vues principales
# =====================

@login_required
def home(request):
    """Page d'accueil - Liste des salons"""
    salons_publics = Salon.objects.filter(est_prive=False)
    mes_salons = Salon.objects.filter(
        memberships__user=request.user, 
        memberships__est_banni=False
    ).distinct()
    
    context = {
        'salons_publics': salons_publics,
        'mes_salons': mes_salons,
    }
    return render(request, 'chat/home.html', context)


@login_required
def creer_salon(request):
    """Créer un nouveau salon"""
    if request.method == 'POST':
        form = SalonForm(request.POST)
        if form.is_valid():
            salon = form.save(commit=False)
            salon.createur = request.user
            salon.save()
            
            # Créer le membership admin pour le créateur
            Membership.objects.create(
                user=request.user,
                salon=salon,
                role='admin'
            )
            
            messages.success(request, f'Salon "{salon.nom}" créé avec succès !')
            return redirect('salon', salon_id=salon.id)
    else:
        form = SalonForm()
    
    return render(request, 'chat/creer_salon.html', {'form': form})


@login_required
def salon(request, salon_id):
    """Vue d'un salon de discussion"""
    salon = get_object_or_404(Salon, id=salon_id)
    
    # Vérifier le membership
    membership = Membership.objects.filter(user=request.user, salon=salon).first()
    
    # Vérifier l'accès au salon privé
    if salon.est_prive and not membership:
        messages.error(request, "Vous n'avez pas accès à ce salon privé.")
        return redirect('home')
    
    # Auto-rejoindre les salons publics
    if not membership and not salon.est_prive:
        membership = Membership.objects.create(
            user=request.user,
            salon=salon,
            role='membre'
        )
    
    # Vérifier si banni
    if membership and membership.est_banni:
        messages.error(request, "Vous avez été banni de ce salon.")
        return redirect('home')
    
    # Récupérer les messages et membres
    messages_salon = salon.messages.filter(est_modere=False).select_related('auteur')
    membres = Membership.objects.filter(salon=salon).select_related('user')
    
    # Déterminer les droits
    is_admin = membership and membership.role == 'admin'
    is_modo = membership and membership.role in ['admin', 'moderateur']
    is_createur = salon.createur == request.user
    
    context = {
        'salon': salon,
        'messages_salon': messages_salon,
        'membres': membres,
        'membership': membership,
        'is_admin': is_admin,
        'is_modo': is_modo,
        'is_createur': is_createur,
    }
    return render(request, 'chat/salon.html', context)


@login_required
def rejoindre_salon(request, salon_id):
    """Rejoindre un salon public"""
    salon = get_object_or_404(Salon, id=salon_id)
    
    if salon.est_prive:
        messages.error(request, "Ce salon est privé.")
        return redirect('home')
    
    membership, created = Membership.objects.get_or_create(
        user=request.user,
        salon=salon,
        defaults={'role': 'membre'}
    )
    
    if membership.est_banni:
        messages.error(request, "Vous êtes banni de ce salon.")
        return redirect('home')
    
    if created:
        messages.success(request, f'Vous avez rejoint le salon "{salon.nom}" !')
    
    return redirect('salon', salon_id=salon.id)


@login_required
def quitter_salon(request, salon_id):
    """Quitter un salon"""
    salon = get_object_or_404(Salon, id=salon_id)
    
    membership = Membership.objects.filter(user=request.user, salon=salon).first()
    
    if membership:
        if salon.createur == request.user:
            messages.error(request, "Vous ne pouvez pas quitter un salon que vous avez créé.")
            return redirect('salon', salon_id=salon.id)
        
        membership.delete()
        messages.info(request, f'Vous avez quitté le salon "{salon.nom}".')
    
    return redirect('home')


# =====================
# API Messages texte
# =====================

@login_required
@require_POST
def envoyer_message(request, salon_id):
    """API pour envoyer un message texte"""
    try:
        salon = get_object_or_404(Salon, id=salon_id)
        
        # Vérifier les droits
        membership = Membership.objects.filter(user=request.user, salon=salon).first()
        if not membership or membership.est_banni:
            return JsonResponse({'success': False, 'error': 'Accès refusé'}, status=403)
        
        # Parser les données
        data = json.loads(request.body)
        contenu = data.get('contenu', '').strip()
        
        if not contenu:
            return JsonResponse({'success': False, 'error': 'Message vide'}, status=400)
        
        # Créer le message
        message = Message.objects.create(
            contenu=contenu,
            type_message='text',
            auteur=request.user,
            salon=salon
        )
        
        return JsonResponse({
            'success': True,
            'message': {
                'id': message.id,
                'contenu': message.contenu,
                'type': 'text',
                'auteur': message.auteur.username,
                'auteur_id': message.auteur.id,
                'date_envoi': message.date_envoi.strftime('%H:%M')
            }
        })
        
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Données invalides'}, status=400)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


# =====================
# API Messages audio
# =====================

@login_required
@require_POST
def envoyer_audio(request, salon_id):
    """API pour envoyer un message vocal"""
    try:
        salon = get_object_or_404(Salon, id=salon_id)
        
        # Vérifier les droits
        membership = Membership.objects.filter(user=request.user, salon=salon).first()
        if not membership or membership.est_banni:
            return JsonResponse({'success': False, 'error': 'Accès refusé'}, status=403)
        
        # Parser les données
        data = json.loads(request.body)
        audio_data = data.get('audio', '')
        duree = data.get('duree', 0)
        
        if not audio_data:
            return JsonResponse({'success': False, 'error': 'Audio vide'}, status=400)
        
        # Vérifier le format base64
        if ',' not in audio_data:
            return JsonResponse({'success': False, 'error': 'Format audio invalide'}, status=400)
        
        # Décoder le base64
        try:
            header, audio_base64 = audio_data.split(',', 1)
            audio_bytes = base64.b64decode(audio_base64)
        except Exception as e:
            return JsonResponse({'success': False, 'error': f'Erreur décodage: {str(e)}'}, status=400)
        
        # Créer le dossier media/audio si nécessaire
        audio_dir = os.path.join(settings.MEDIA_ROOT, 'audio', f'salon_{salon_id}')
        os.makedirs(audio_dir, exist_ok=True)
        
        # Créer le message
        message = Message.objects.create(
            type_message='audio',
            duree_audio=duree,
            auteur=request.user,
            salon=salon
        )
        
        # Sauvegarder le fichier audio
        filename = f'audio_{uuid.uuid4().hex}.webm'
        message.fichier_audio.save(filename, ContentFile(audio_bytes))
        message.save()
        
        return JsonResponse({
            'success': True,
            'message': {
                'id': message.id,
                'type': 'audio',
                'audio_url': message.fichier_audio.url,
                'duree': message.duree_audio,
                'auteur': message.auteur.username,
                'auteur_id': message.auteur.id,
                'date_envoi': message.date_envoi.strftime('%H:%M')
            }
        })
        
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'JSON invalide'}, status=400)
    except Exception as e:
        return JsonResponse({'success': False, 'error': f'Erreur: {str(e)}'}, status=500)


# =====================
# API Charger messages
# =====================

@login_required
@require_GET
def charger_messages(request, salon_id):
    """API pour charger les nouveaux messages (polling)"""
    try:
        salon = get_object_or_404(Salon, id=salon_id)
        
        # Vérifier les droits
        membership = Membership.objects.filter(user=request.user, salon=salon).first()
        if not membership or membership.est_banni:
            return JsonResponse({'success': False, 'error': 'Accès refusé'}, status=403)
        
        # Récupérer last_id
        last_id = request.GET.get('last_id', 0)
        try:
            last_id = int(last_id)
        except ValueError:
            last_id = 0
        
        # Récupérer les nouveaux messages
        messages_list = salon.messages.filter(
            est_modere=False,
            id__gt=last_id
        ).select_related('auteur').order_by('date_envoi')
        
        # Construire la réponse
        messages_data = []
        for msg in messages_list:
            msg_data = {
                'id': msg.id,
                'type': msg.type_message,
                'auteur': msg.auteur.username,
                'auteur_id': msg.auteur.id,
                'date_envoi': msg.date_envoi.strftime('%H:%M')
            }
            
            if msg.type_message == 'text':
                msg_data['contenu'] = msg.contenu or ''
            elif msg.type_message == 'audio':
                if msg.fichier_audio and msg.fichier_audio.name:
                    msg_data['audio_url'] = msg.fichier_audio.url
                else:
                    msg_data['audio_url'] = ''
                msg_data['duree'] = msg.duree_audio if msg.duree_audio else 0
            
            messages_data.append(msg_data)
        
        return JsonResponse({
            'success': True,
            'messages': messages_data,
            'user_id': request.user.id
        })
        
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


# =====================
# API Modération
# =====================

@login_required
@require_POST
def supprimer_message(request, salon_id, message_id):
    """Supprimer (modérer) un message"""
    try:
        salon = get_object_or_404(Salon, id=salon_id)
        message = get_object_or_404(Message, id=message_id, salon=salon)
        
        # Vérifier les droits
        membership = Membership.objects.filter(user=request.user, salon=salon).first()
        
        is_modo = membership and membership.role in ['admin', 'moderateur']
        is_auteur = message.auteur == request.user
        
        if not (is_modo or is_auteur):
            return JsonResponse({'success': False, 'error': 'Permission refusée'}, status=403)
        
        # Supprimer le fichier audio si présent
        if message.type_message == 'audio' and message.fichier_audio:
            try:
                file_path = message.fichier_audio.path
                if file_path and os.path.isfile(file_path):
                    os.remove(file_path)
            except Exception:
                pass
        
        # Marquer comme modéré
        message.est_modere = True
        message.save()
        
        return JsonResponse({'success': True, 'message': 'Message supprimé'})
        
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@login_required
@require_POST
def changer_role(request, salon_id, user_id):
    """Changer le rôle d'un membre"""
    try:
        salon = get_object_or_404(Salon, id=salon_id)
        target_user = get_object_or_404(User, id=user_id)
        
        # Vérifier que l'utilisateur est admin
        membership = Membership.objects.filter(user=request.user, salon=salon).first()
        if not membership or membership.role != 'admin':
            return JsonResponse({'success': False, 'error': 'Permission refusée'}, status=403)
        
        # Récupérer le membership cible
        target_membership = Membership.objects.filter(user=target_user, salon=salon).first()
        if not target_membership:
            return JsonResponse({'success': False, 'error': 'Utilisateur non membre'}, status=404)
        
        # Le créateur ne peut pas être modifié
        if target_user == salon.createur:
            return JsonResponse({'success': False, 'error': 'Impossible de modifier le créateur'}, status=403)
        
        # Parser les données
        data = json.loads(request.body)
        nouveau_role = data.get('role', '').strip()
        
        if nouveau_role not in ['membre', 'moderateur', 'admin']:
            return JsonResponse({'success': False, 'error': 'Rôle invalide'}, status=400)
        
        target_membership.role = nouveau_role
        target_membership.save()
        
        return JsonResponse({
            'success': True,
            'message': f'{target_user.username} est maintenant {nouveau_role}',
            'role': nouveau_role
        })
        
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Données invalides'}, status=400)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@login_required
@require_POST
def bannir_membre(request, salon_id, user_id):
    """Bannir ou débannir un membre"""
    try:
        salon = get_object_or_404(Salon, id=salon_id)
        target_user = get_object_or_404(User, id=user_id)
        
        # Vérifier les droits (modo ou admin)
        membership = Membership.objects.filter(user=request.user, salon=salon).first()
        if not membership or membership.role not in ['admin', 'moderateur']:
            return JsonResponse({'success': False, 'error': 'Permission refusée'}, status=403)
        
        # Récupérer le membership cible
        target_membership = Membership.objects.filter(user=target_user, salon=salon).first()
        if not target_membership:
            return JsonResponse({'success': False, 'error': 'Utilisateur non membre'}, status=404)
        
        # Le créateur ne peut pas être banni
        if target_user == salon.createur:
            return JsonResponse({'success': False, 'error': 'Impossible de bannir le créateur'}, status=403)
        
        # Un modo ne peut pas bannir un admin
        if membership.role == 'moderateur' and target_membership.role == 'admin':
            return JsonResponse({'success': False, 'error': 'Impossible de bannir un admin'}, status=403)
        
        # Parser les données
        data = json.loads(request.body)
        action = data.get('action', 'ban')
        
        if action == 'ban':
            target_membership.est_banni = True
            msg = f'{target_user.username} a été banni'
        else:
            target_membership.est_banni = False
            msg = f'{target_user.username} a été débanni'
        
        target_membership.save()
        
        return JsonResponse({
            'success': True,
            'message': msg,
            'est_banni': target_membership.est_banni
        })
        
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Données invalides'}, status=400)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@login_required
@require_POST
def inviter_membre(request, salon_id):
    """Inviter un utilisateur dans un salon"""
    try:
        salon = get_object_or_404(Salon, id=salon_id)
        
        # Vérifier que l'utilisateur est admin
        membership = Membership.objects.filter(user=request.user, salon=salon).first()
        if not membership or membership.role != 'admin':
            return JsonResponse({'success': False, 'error': 'Permission refusée'}, status=403)
        
        # Parser les données
        data = json.loads(request.body)
        username = data.get('username', '').strip()
        
        if not username:
            return JsonResponse({'success': False, 'error': 'Nom d\'utilisateur requis'}, status=400)
        
        # Trouver l'utilisateur
        target_user = User.objects.filter(username__iexact=username).first()
        if not target_user:
            return JsonResponse({'success': False, 'error': 'Utilisateur non trouvé'}, status=404)
        
        # Vérifier s'il est déjà membre
        existing = Membership.objects.filter(user=target_user, salon=salon).first()
        if existing:
            if existing.est_banni:
                return JsonResponse({'success': False, 'error': 'Cet utilisateur est banni'}, status=400)
            return JsonResponse({'success': False, 'error': 'Déjà membre du salon'}, status=400)
        
        # Créer le membership
        Membership.objects.create(
            user=target_user,
            salon=salon,
            role='membre'
        )
        
        return JsonResponse({
            'success': True,
            'message': f'{target_user.username} a été invité',
            'user': {
                'id': target_user.id,
                'username': target_user.username
            }
        })
        
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Données invalides'}, status=400)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@login_required
@require_POST
def expulser_membre(request, salon_id, user_id):
    """Expulser un membre du salon"""
    try:
        salon = get_object_or_404(Salon, id=salon_id)
        target_user = get_object_or_404(User, id=user_id)
        
        # Vérifier que l'utilisateur est admin
        membership = Membership.objects.filter(user=request.user, salon=salon).first()
        if not membership or membership.role != 'admin':
            return JsonResponse({'success': False, 'error': 'Permission refusée'}, status=403)
        
        # Récupérer le membership cible
        target_membership = Membership.objects.filter(user=target_user, salon=salon).first()
        if not target_membership:
            return JsonResponse({'success': False, 'error': 'Utilisateur non membre'}, status=404)
        
        # Le créateur ne peut pas être expulsé
        if target_user == salon.createur:
            return JsonResponse({'success': False, 'error': 'Impossible d\'expulser le créateur'}, status=403)
        
        target_membership.delete()
        
        return JsonResponse({
            'success': True,
            'message': f'{target_user.username} a été expulsé'
        })
        
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@login_required
@require_GET
def get_membres(request, salon_id):
    """Récupérer la liste des membres"""
    try:
        salon = get_object_or_404(Salon, id=salon_id)
        
        # Vérifier les droits
        membership = Membership.objects.filter(user=request.user, salon=salon).first()
        if not membership or membership.est_banni:
            return JsonResponse({'success': False, 'error': 'Accès refusé'}, status=403)
        
        # Récupérer les membres
        membres = Membership.objects.filter(salon=salon).select_related('user')
        
        membres_data = [{
            'id': m.user.id,
            'username': m.user.username,
            'role': m.role,
            'est_banni': m.est_banni,
            'is_createur': m.user == salon.createur
        } for m in membres]
        
        return JsonResponse({
            'success': True,
            'membres': membres_data
        })
        
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)