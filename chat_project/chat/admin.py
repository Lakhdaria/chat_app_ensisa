# admin.py

from django.contrib import admin
from .models import Salon, Membership, Message


class SalonAdmin(admin.ModelAdmin):
    list_display = ['nom', 'createur', 'date_creation', 'est_prive']
    list_filter = ['est_prive', 'date_creation']
    search_fields = ['nom', 'description']

class MembershipAdmin(admin.ModelAdmin):
    list_display = ['user', 'salon', 'role', 'est_banni', 'date_joined']
    list_filter = ['role', 'est_banni']
    search_fields = ['user__username', 'salon__nom']

class MessageAdmin(admin.ModelAdmin):
    list_display = ['auteur', 'salon', 'get_contenu', 'date_envoi', 'est_modere']
    list_filter = ['salon', 'est_modere', 'date_envoi']
    search_fields = ['contenu', 'auteur__username']

    # affiche juste le debut du message
    def get_contenu(self, obj):
        if obj.contenu == None:
            return ''
        if len(obj.contenu) > 50:
            return obj.contenu[:50] + '...'
        return obj.contenu
    get_contenu.short_description = 'Contenu'


# register
admin.site.register(Salon, SalonAdmin)
admin.site.register(Membership, MembershipAdmin)
admin.site.register(Message, MessageAdmin)