# Ejecuta el servidor ASGI (Django Channels) con Daphne con `python app.py`
import os


def main():
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
    try:
        from daphne.cli import CommandLineInterface
    except Exception as e:
        print("Error: faltan dependencias. Instala con `pip install -r requirements.txt`.")
        raise

    host = os.environ.get("HOST", "127.0.0.1")
    port = os.environ.get("PORT", "8000")

    # Ejecuta: daphne -b 127.0.0.1 -p 8000 backend.asgi:application
    CommandLineInterface().run(["-b", host, "-p", port, "backend.asgi:application"])  # type: ignore


if __name__ == "__main__":
    main()
