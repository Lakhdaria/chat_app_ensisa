# 💬 Chat App ENSISA

Application de chat en temps réel développée avec Django pour le cours de Technologies Web II.

![Python](https://img.shields.io/badge/Python-3.10+-3776ab?logo=python&logoColor=white)
![Django](https://img.shields.io/badge/Django-5.0-092e20?logo=django&logoColor=white)
![Bootstrap](https://img.shields.io/badge/Bootstrap-5.3-7952b3?logo=bootstrap&logoColor=white)

---

## 🎯 Fonctionnalités

### Authentification
- Inscription avec email
- Connexion / Déconnexion
- Gestion des sessions

### Salons de discussion
- Création de salons publics ou privés
- Rejoindre / Quitter un salon
- Masquer des salons de sa liste
- Suppression de salon (créateur uniquement)

### Messagerie
- Messages texte en temps réel
- Messages vocaux (enregistrement audio)
- Envoi d'images
- Polling automatique pour les nouveaux messages

### Modération
- Système de rôles : Membre, Modérateur, Admin
- Bannissement / Débannissement
- Expulsion de membres
- Invitation dans les salons privés
- Suppression de messages

### Interface
- Design moderne en dark mode
- Interface responsive (mobile-friendly)
- Animations fluides

---

## 🚀 Installation

### Prérequis
- Python 3.10 ou supérieur
- pip

### Étapes

```bash
# 1. Cloner le repo
git clone https://github.com/Lakhdaria/chat_app_ensisa.git
cd chat_app_ensisa/chat_project

# 2. Créer un environnement virtuel
python -m venv venv

# 3. Activer l'environnement
# Windows PowerShell :
.\venv\Scripts\Activate.ps1
# Windows CMD :
venv\Scripts\activate.bat
# Linux/Mac :
source venv/bin/activate

# 4. Installer les dépendances
pip install django pillow

# 5. Appliquer les migrations
python manage.py migrate

# 6. Lancer le serveur
python manage.py runserver
```

L'application sera accessible sur `http://127.0.0.1:8000`

---

## 🔐 Compte Administrateur

Un compte admin est déjà configuré pour tester :

| Champ | Valeur |
|-------|--------|
| **Utilisateur** | `sofiane_admin` |
| **Mot de passe** | `12345` |

Ce compte a accès au panneau d'administration et peut gérer tous les salons.

---

## 📁 Structure du projet

```
chat_project/
├── chat/                   # Application principale
│   ├── templates/chat/     # Templates HTML
│   ├── models.py           # Modèles (Salon, Message, Membership)
│   ├── views.py            # Vues et API
│   ├── urls.py             # Routes
│   ├── forms.py            # Formulaires
│   └── admin.py            # Config admin Django
├── config/                 # Configuration Django
│   ├── settings.py
│   └── urls.py
├── static/                 # Fichiers statiques
│   └── js/chat.js
├── templates/              # Templates globaux
│   └── base.html
└── manage.py
```

---

## 🛠️ Technologies utilisées

| Technologie | Usage |
|-------------|-------|
| **Django 5** | Backend / Framework web |
| **SQLite** | Base de données |
| **Bootstrap 5** | Framework CSS |
| **jQuery** | Requêtes AJAX |
| **Bootstrap Icons** | Icônes |

---

## 📝 API Endpoints

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/salon/<id>/envoyer/` | Envoyer un message texte |
| POST | `/api/salon/<id>/audio/` | Envoyer un message vocal |
| POST | `/api/salon/<id>/image/` | Envoyer une image |
| GET | `/api/salon/<id>/messages/` | Charger les messages |
| POST | `/api/salon/<id>/membre/<uid>/bannir/` | Bannir un membre |
| POST | `/api/salon/<id>/membre/<uid>/role/` | Changer le rôle |
| POST | `/api/salon/<id>/inviter/` | Inviter un membre |

---

## 👤 Auteur

**Sofiane aka Lakhdaria / Vlad / Amine ** - ENSISA -IR

---

## 📄 Licence

Projet réalisé dans le cadre du cours de Technologies Web II à l'ENSISA.
