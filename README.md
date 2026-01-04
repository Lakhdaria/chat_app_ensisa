# 💬 Django Chat Application

[![Python](https://img.shields.io/badge/Python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![Django](https://img.shields.io/badge/Django-5.0+-green.svg)](https://www.djangoproject.com/)
[![Bootstrap](https://img.shields.io/badge/Bootstrap-5.3-purple.svg)](https://getbootstrap.com/)

Application de chat en temps réel développée avec Django, featuring des salons de discussion, des messages vocaux, et un système de modération complet.

![Chat Preview](https://via.placeholder.com/800x400/667eea/ffffff?text=Django+Chat+Application)

---

## ✨ Fonctionnalités

### 💬 Messagerie
- [x] Messages texte en temps réel (polling AJAX)
- [x] Messages vocaux avec enregistrement intégré
- [x] Emojis picker intégré
- [x] Historique des messages persistant

### 🏠 Salons
- [x] Création de salons publics et privés
- [x] Rejoindre / Quitter un salon
- [x] Invitation de membres (salons privés)
- [x] Liste des membres en temps réel

### 👮 Modération
- [x] Système de rôles (Membre, Modérateur, Admin)
- [x] Bannissement / Débannissement
- [x] Expulsion de membres
- [x] Suppression de messages

### 🔐 Authentification
- [x] Inscription / Connexion / Déconnexion
- [x] Protection des routes
- [x] Sessions utilisateur

---

## 🛠️ Technologies

| Catégorie | Technologies |
|-----------|-------------|
| **Backend** | Python 3.10+, Django 5.0 |
| **Frontend** | HTML5, CSS3, JavaScript (jQuery) |
| **UI Framework** | Bootstrap 5.3, Bootstrap Icons |
| **Base de données** | SQLite (dev) / PostgreSQL (prod) |
| **Audio** | MediaRecorder API, WebM/Opus |

---

## 📁 Structure du Projet
```
chat_project/
├── 📂 config/                 # Configuration Django
│   ├── settings.py
│   ├── urls.py
│   └── wsgi.py
├── 📂 chat/                   # Application principale
│   ├── 📂 templates/chat/     # Templates HTML
│   │   ├── base.html
│   │   ├── home.html
│   │   ├── salon.html
│   │   ├── connexion.html
│   │   └── inscription.html
│   ├── models.py              # Modèles (Salon, Message, Membership)
│   ├── views.py               # Vues et API
│   ├── forms.py               # Formulaires
│   └── urls.py                # Routes
├── 📂 static/                 # Fichiers statiques
│   ├── 📂 css/
│   └── 📂 js/
│       └── chat.js            # Client JavaScript
├── 📂 media/                  # Fichiers uploadés
│   └── 📂 audio/              # Messages vocaux
├── manage.py
└── requirements.txt
```

---

## 🚀 Installation

### Prérequis

- Python 3.10 ou supérieur
- pip (gestionnaire de paquets Python)
- Git

### Étapes

1. **Cloner le repository**
```bash
git clone https://github.com/votre-username/django-chat.git
cd django-chat
```

2. **Créer un environnement virtuel**
```bash
# Windows
python -m venv venv
.\venv\Scripts\activate

# Linux/macOS
python3 -m venv venv
source venv/bin/activate
```

3. **Installer les dépendances**
```bash
pip install -r requirements.txt
```

4. **Configurer la base de données**
```bash
python manage.py makemigrations
python manage.py migrate
```

5. **Créer un superutilisateur**
```bash
python manage.py createsuperuser
```

6. **Lancer le serveur**
```bash
python manage.py runserver
```

7. **Accéder à l'application**

Ouvrez votre navigateur à l'adresse : http://127.0.0.1:8000

---

## 📝 Configuration

### Variables d'environnement

Créez un fichier `.env` à la racine du projet :
```env
SECRET_KEY=votre-cle-secrete-ici
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
DATABASE_URL=sqlite:///db.sqlite3
```

### Configuration Production
```python
# config/settings.py

DEBUG = False
ALLOWED_HOSTS = ['votre-domaine.com']

# Base de données PostgreSQL
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'chat_db',
        'USER': 'chat_user',
        'PASSWORD': 'mot_de_passe',
        'HOST': 'localhost',
        'PORT': '5432',
    }
}
```

---

## 📚 API Endpoints

### Messages

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `POST` | `/api/salon/<id>/envoyer/` | Envoyer un message texte |
| `POST` | `/api/salon/<id>/audio/` | Envoyer un message vocal |
| `GET` | `/api/salon/<id>/messages/` | Charger les nouveaux messages |
| `POST` | `/api/salon/<id>/message/<id>/supprimer/` | Supprimer un message |

### Modération

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `POST` | `/api/salon/<id>/membre/<user_id>/role/` | Changer le rôle |
| `POST` | `/api/salon/<id>/membre/<user_id>/bannir/` | Bannir/Débannir |
| `POST` | `/api/salon/<id>/membre/<user_id>/expulser/` | Expulser |
| `POST` | `/api/salon/<id>/inviter/` | Inviter un membre |
| `GET` | `/api/salon/<id>/membres/` | Liste des membres |

### Exemple de requête
```javascript
// Envoyer un message
fetch('/api/salon/1/envoyer/', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken
    },
    body: JSON.stringify({ contenu: 'Hello World!' })
});
```


## 🧪 Tests
```bash
# Lancer tous les tests
python manage.py test

# Lancer les tests avec couverture
coverage run manage.py test
coverage report
```

---

## 🤝 Contribution

Les contributions sont les bienvenues ! Voici comment contribuer :

1. **Fork** le projet
2. **Créer** une branche (`git checkout -b feature/AmazingFeature`)
3. **Commit** vos changements (`git commit -m 'Add AmazingFeature'`)
4. **Push** sur la branche (`git push origin feature/AmazingFeature`)
5. **Ouvrir** une Pull Request

### Guidelines

- Suivre les conventions PEP 8 pour Python
- Écrire des tests pour les nouvelles fonctionnalités
- Mettre à jour la documentation si nécessaire

---

## 📋 Roadmap

- [ ] 🔄 WebSockets pour le temps réel (Django Channels)
- [ ] 🔔 Notifications push
- [ ] 📎 Partage de fichiers (images, documents)
- [ ] 🔍 Recherche dans les messages
- [ ] 👤 Profils utilisateurs avec avatars
- [ ] 🌙 Mode sombre
- [ ] 📱 Application mobile (React Native)
- [ ] 🌐 Internationalisation (i18n)



## 📄 License

Ce projet est sous licence MIT. Voir le fichier [LICENSE](LICENSE) pour plus de détails.
```
MIT License

Copyright (c) 2024 Votre Nom

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software...
```





<p align="center">
  Made with ❤️ and ☕ by Sofiane BOUGUERRI ; Amine et Vladyslav VASILIEV
</p>

<p align="center">
  <a href="#-django-chat-application">⬆️ Retour en haut</a>
</p>


---

### Fichier `requirements.txt` à créer :
```
Django>=5.0
Pillow>=10.0
python-dotenv>=1.0
```

---
