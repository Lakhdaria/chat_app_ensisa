from django.contrib import admin
from .models import Salon, Membership, Message


@admin.register(Salon)
class SalonAdmin(admin.ModelAdmin):
    list_display = ['nom', 'createur', 'date_creation', 'est_prive']
    list_filter = ['est_prive', 'date_creation']
    search_fields = ['nom', 'description']


@admin.register(Membership)
class MembershipAdmin(admin.ModelAdmin):
    list_display = ['user', 'salon', 'role', 'est_banni', 'date_joined']
    list_filter = ['role', 'est_banni']
    search_fields = ['user__username', 'salon__nom']


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ['auteur', 'salon', 'contenu_court', 'date_envoi', 'est_modere']
    list_filter = ['salon', 'est_modere', 'date_envoi']
    search_fields = ['contenu', 'auteur__username']

    def contenu_court(self, obj):
        return obj.contenu[:50] + "..." if len(obj.contenu) > 50 else obj.contenu
    contenu_court.short_description = 'Contenu'