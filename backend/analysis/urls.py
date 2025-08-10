from django.urls import path
from . import views

urlpatterns = [
    path("start-job", views.start_job, name="start_job"),
]
