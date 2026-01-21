# models.py

from django.db import models
from django.contrib.auth.models import User


# pour generer le chemin des fichiers audio
def audio_upload_path(instance, filename):
    return 'audio/salon_' + str(instance.salon.id) + '/' + filename

# pareil pour les images
def image_upload_path(instance, filename):
    return 'images/salon_' + str(instance.salon.id) + '/' + filename


class Salon(models.Model):
    nom = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)
    createur = models.ForeignKey(User, on_delete=models.CASCADE, related_name='salons_crees')
    date_creation = models.DateTimeField(auto_now_add=True)
    est_prive = models.BooleanField(default=False)

    class Meta:
        ordering = ['-date_creation']

    def __str__(self):
        return self.nom


# pour que l'user puisse masquer des salons de sa liste
class SalonMasque(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='salons_masques')
    salon = models.ForeignKey(Salon, on_delete=models.CASCADE, related_name='masque_par')
    date_masque = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['user', 'salon']

    def __str__(self):
        return self.user.username + ' a masque ' + self.salon.nom


# le membership c'est la relation user <-> salon avec le role
class Membership(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='memberships')
    salon = models.ForeignKey(Salon, on_delete=models.CASCADE, related_name='memberships')
    role = models.CharField(max_length=20, default='membre')  # membre, moderateur ou admin
    date_joined = models.DateTimeField(auto_now_add=True)
    est_banni = models.BooleanField(default=False)

    class Meta:
        unique_together = ['user', 'salon']

    def __str__(self):
        return self.user.username + ' - ' + self.salon.nom + ' (' + self.role + ')'


class Message(models.Model):
    # champs de base
    contenu = models.TextField(blank=True, null=True)  # pour les msg texte
    type_message = models.CharField(max_length=10, default='text')  # text, audio ou image
    
    # si c'est un audio
    fichier_audio = models.FileField(upload_to=audio_upload_path, blank=True, null=True)
    duree_audio = models.FloatField(blank=True, null=True)
    
    # si c'est une image
    fichier_image = models.ImageField(upload_to=image_upload_path, blank=True, null=True)
    
    # relations
    auteur = models.ForeignKey(User, on_delete=models.CASCADE, related_name='messages')
    salon = models.ForeignKey(Salon, on_delete=models.CASCADE, related_name='messages')
    
    date_envoi = models.DateTimeField(auto_now_add=True)
    est_modere = models.BooleanField(default=False)  # si le msg a ete supprime par un modo

    class Meta:
        ordering = ['date_envoi']

    def __str__(self):
        # j'affiche different selon le type
        if self.type_message == 'audio':
            return self.auteur.username + ': [Audio]'
        if self.type_message == 'image':
            return self.auteur.username + ': [Image]'
        
        txt = ''
        if self.contenu:
            txt = self.contenu[:30]
        return self.auteur.username + ': ' + txt + '...'