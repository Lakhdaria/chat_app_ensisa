FROM python:3.11-slim

WORKDIR /app

# Variables d'environnement
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Installer les dépendances
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copier le projet
COPY . .

# Collecter les fichiers statiques
RUN python manage.py collectstatic --no-input

# Exposer le port
EXPOSE 8080

# Lancer l'application
CMD python manage.py migrate --no-input && gunicorn config.wsgi:application --bind 0.0.0.0:8080
