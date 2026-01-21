from django.urls import path
from . import views

# toutes les urls de l'app
urlpatterns = [
    path('', views.home, name='home'),
    
    # auth
    path('inscription/', views.inscription, name='inscription'),
    path('connexion/', views.connexion, name='connexion'),
    path('deconnexion/', views.deconnexion, name='deconnexion'),
    
    # salons
    path('salon/creer/', views.creer_salon, name='creer_salon'),
    path('salon/<int:salon_id>/', views.salon, name='salon'),
    path('salon/<int:salon_id>/rejoindre/', views.rejoindre_salon, name='rejoindre_salon'),
    path('salon/<int:salon_id>/quitter/', views.quitter_salon, name='quitter_salon'),
]

# j'ai mis les api a part pour mieux m'y retrouver
urlpatterns += [
    path('api/salon/<int:salon_id>/envoyer/', views.envoyer_message, name='envoyer_message'),
    path('api/salon/<int:salon_id>/audio/', views.envoyer_audio, name='envoyer_audio'),
    path('api/salon/<int:salon_id>/image/', views.envoyer_image, name='envoyer_image'),
    path('api/salon/<int:salon_id>/messages/', views.charger_messages, name='charger_messages'),
]

# moderation
urlpatterns += [
    path('api/salon/<int:salon_id>/message/<int:message_id>/supprimer/', views.supprimer_message, name='supprimer_message'),
    path('api/salon/<int:salon_id>/membre/<int:user_id>/role/', views.changer_role, name='changer_role'),
    path('api/salon/<int:salon_id>/membre/<int:user_id>/bannir/', views.bannir_membre, name='bannir_membre'),
    path('api/salon/<int:salon_id>/membre/<int:user_id>/expulser/', views.expulser_membre, name='expulser_membre'),
    path('api/salon/<int:salon_id>/inviter/', views.inviter_membre, name='inviter_membre'),
    path('api/salon/<int:salon_id>/membres/', views.get_membres, name='get_membres'),
]

# les 3 dernieres pour gerer les salons
urlpatterns += [
    path('api/salon/<int:salon_id>/masquer/', views.masquer_salon, name='masquer_salon'),
    path('api/salon/<int:salon_id>/afficher/', views.afficher_salon, name='afficher_salon'),
    path('api/salon/<int:salon_id>/supprimer/', views.supprimer_salon, name='supprimer_salon'),
]