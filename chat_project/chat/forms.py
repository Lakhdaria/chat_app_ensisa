# forms.py

from django import forms
from django.contrib.auth.models import User
from django.contrib.auth.forms import UserCreationForm, AuthenticationForm
from .models import Salon


# formulaire inscription
class InscriptionForm(UserCreationForm):
    email = forms.EmailField(required=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'password1', 'password2']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # j'ajoute les classes bootstrap sur tous les champs
        for field in self.fields:
            self.fields[field].widget.attrs['class'] = 'form-control'
            self.fields[field].widget.attrs['placeholder'] = self.fields[field].label


# formulaire connexion
class ConnexionForm(AuthenticationForm):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for field in self.fields:
            self.fields[field].widget.attrs['class'] = 'form-control'
            self.fields[field].widget.attrs['placeholder'] = self.fields[field].label


# formulaire creation salon
class SalonForm(forms.ModelForm):
    class Meta:
        model = Salon
        fields = ['nom', 'description', 'est_prive']
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        
        # nom
        self.fields['nom'].widget.attrs['class'] = 'form-control'
        self.fields['nom'].widget.attrs['placeholder'] = 'Nom du salon'
        
        # description
        self.fields['description'].widget.attrs['class'] = 'form-control'
        self.fields['description'].widget.attrs['placeholder'] = 'Description (optionnel)'
        self.fields['description'].widget.attrs['rows'] = 3
        
        # checkbox prive
        self.fields['est_prive'].widget.attrs['class'] = 'form-check-input'