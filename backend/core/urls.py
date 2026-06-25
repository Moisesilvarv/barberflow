from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .views import (
    AppointmentDetailView,
    AppointmentListCreateView,
    LoginView,
    health_check,
    logout,
    me,
    public_appointment,
    public_availability,
    register,
)


urlpatterns = [
    path("health/", health_check, name="health-check"),
    path("register/", register, name="register"),
    path("login/", LoginView.as_view(), name="login"),
    path("logout/", logout, name="logout"),
    path("token/", TokenObtainPairView.as_view(), name="token-obtain-pair"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("me/", me, name="me"),
    path("appointments/", AppointmentListCreateView.as_view(), name="appointment-list"),
    path("appointments/<int:pk>/", AppointmentDetailView.as_view(), name="appointment-detail"),
    path(
        "public/<int:barbershop_id>/availability/",
        public_availability,
        name="public-availability",
    ),
    path("public/appointment/", public_appointment, name="public-appointment"),
]
