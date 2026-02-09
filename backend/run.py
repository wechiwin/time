# backend/run.py
from app.extension import db
from app.factory import build_app

app = build_app()

# You might need to initialize db with the app if it's not done in create_app
# For example, if you're using Flask-SQLAlchemy:
# db.init_app(app)

# This block ensures that all database tables defined in your models.py
# are created in the 'site.db' file when the application starts.
with app.app_context():
    print("Attempting to create database tables...")
    db.create_all()
    print("Database tables created (if they didn't exist).")

if __name__ == '__main__':
    # You might want to create tables here for development
    # with app.app_context():
    #     db.create_all()
    app.run(debug=True,
            use_reloader=False,
            host='0.0.0.0')  # host='0.0.0.0' makes it accessible from other machines in your network, useful for Docker
