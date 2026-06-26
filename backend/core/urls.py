from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .platform_views import (
    PlatformBarberShopDetailView,
    PlatformBarberShopListView,
    platform_dashboard,
    reactivate_barber_shop,
    suspend_barber_shop,
)
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
    path("token/", LoginView.as_view(), name="token-obtain-pair"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("me/", me, name="me"),
    path("appointments/", AppointmentListCreateView.as_view(), name="appointment-list"),
    path("appointments/<int:pk>/", AppointmentDetailView.as_view(), name="appointment-detail"),
    path("platform/dashboard/", platform_dashboard, name="platform-dashboard"),
    path("platform/barbershops/", PlatformBarberShopListView.as_view(), name="platform-barbershop-list"),
    path("platform/barbershops/<int:pk>/", PlatformBarberShopDetailView.as_view(), name="platform-barbershop-detail"),
    path("platform/barbershops/<int:pk>/suspend/", suspend_barber_shop, name="platform-barbershop-suspend"),
    path("platform/barbershops/<int:pk>/reactivate/", reactivate_barber_shop, name="platform-barbershop-reactivate"),
    path(
        "public/<int:barbershop_id>/availability/",
        public_availability,
        name="public-availability",
    ),
    path("public/appointment/", public_appointment, name="public-appointment"),
]
