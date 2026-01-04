from django.db import models
from django.contrib.auth.models import User
import os


def audio_upload_path(instance, filename):
    """Chemin d'upload pour les fichiers audio"""
    return f'audio/salon_{instance.salon.id}/{filename}'


class Salon(models.Model):
    """Salon de discussion"""
    nom = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)
    createur = models.ForeignKey(User, on_delete=models.CASCADE, related_name='salons_crees')
    date_creation = models.DateTimeField(auto_now_add=True)
    est_prive = models.BooleanField(default=False)

    class Meta:
        ordering = ['-date_creation']
        verbose_name = 'Salon'
        verbose_name_plural = 'Salons'

    def __str__(self):
        return self.nom


class Membership(models.Model):
    """Relation entre un utilisateur et un salon avec son rôle"""
    ROLE_CHOICES = [
        ('membre', 'Membre'),
        ('moderateur', 'Modérateur'),
        ('admin', 'Administrateur'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='memberships')
    salon = models.ForeignKey(Salon, on_delete=models.CASCADE, related_name='memberships')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='membre')
    date_joined = models.DateTimeField(auto_now_add=True)
    est_banni = models.BooleanField(default=False)

    class Meta:
        unique_together = ['user', 'salon']
        verbose_name = 'Membership'
        verbose_name_plural = 'Memberships'

    def __str__(self):
        return f"{self.user.username} - {self.salon.nom} ({self.role})"


class Message(models.Model):
    """Message dans un salon"""
    TYPE_CHOICES = [
        ('text', 'Texte'),
        ('audio', 'Audio'),
    ]
    
    contenu = models.TextField(blank=True, null=True)
    type_message = models.CharField(max_length=10, choices=TYPE_CHOICES, default='text')
    fichier_audio = models.FileField(upload_to=audio_upload_path, blank=True, null=True)
    duree_audio = models.FloatField(blank=True, null=True)
    auteur = models.ForeignKey(User, on_delete=models.CASCADE, related_name='messages')
    salon = models.ForeignKey(Salon, on_delete=models.CASCADE, related_name='messages')
    date_envoi = models.DateTimeField(auto_now_add=True)
    est_modere = models.BooleanField(default=False)

    class Meta:
        ordering = ['date_envoi']
        verbose_name = 'Message'
        verbose_name_plural = 'Messages'

    def __str__(self):
        if self.type_message == 'audio':
            return f"{self.auteur.username}: [Audio]"
        return f"{self.auteur.username}: {self.contenu[:30] if self.contenu else ''}..."