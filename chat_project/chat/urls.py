from django.urls import path
from . import views

urlpatterns = [
    path('', views.home, name='home'),
    path('inscription/', views.inscription, name='inscription'),
    path('connexion/', views.connexion, name='connexion'),
    path('deconnexion/', views.deconnexion, name='deconnexion'),
    
    # Salons
    path('salon/creer/', views.creer_salon, name='creer_salon'),
    path('salon/<int:salon_id>/', views.salon, name='salon'),
    path('salon/<int:salon_id>/rejoindre/', views.rejoindre_salon, name='rejoindre_salon'),
    path('salon/<int:salon_id>/quitter/', views.quitter_salon, name='quitter_salon'),
    
    # API Messages
    path('api/salon/<int:salon_id>/envoyer/', views.envoyer_message, name='envoyer_message'),
    path('api/salon/<int:salon_id>/audio/', views.envoyer_audio, name='envoyer_audio'),
    path('api/salon/<int:salon_id>/messages/', views.charger_messages, name='charger_messages'),
    
    # API Modération
    path('api/salon/<int:salon_id>/message/<int:message_id>/supprimer/', views.supprimer_message, name='supprimer_message'),
    path('api/salon/<int:salon_id>/membre/<int:user_id>/role/', views.changer_role, name='changer_role'),
    path('api/salon/<int:salon_id>/membre/<int:user_id>/bannir/', views.bannir_membre, name='bannir_membre'),
    path('api/salon/<int:salon_id>/membre/<int:user_id>/expulser/', views.expulser_membre, name='expulser_membre'),
    path('api/salon/<int:salon_id>/inviter/', views.inviter_membre, name='inviter_membre'),
    path('api/salon/<int:salon_id>/membres/', views.get_membres, name='get_membres'),
]