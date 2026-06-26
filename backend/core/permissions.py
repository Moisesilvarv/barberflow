from rest_framework.permissions import BasePermission

from .models import BarberShop


SUSPENDED_BARBERSHOP_MESSAGE = "Sua conta esta suspensa. Entre em contato com o suporte do BarberFlow."


def is_platform_admin_user(user):
    """Checks the platform admin flag without requiring a custom User model."""

    if getattr(user, "is_superuser", False) or getattr(user, "is_staff", False):
        return True

    profile = getattr(user, "profile", None)
    return bool(profile and profile.is_platform_admin)


class IsPlatformAdmin(BasePermission):
    """Allows access only to authenticated users flagged as BarberFlow platform admins."""

    message = "Acesso permitido apenas para administradores da plataforma."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        return is_platform_admin_user(user)


class IsActiveBarberShop(BasePermission):
    """Blocks suspended tenant accounts from using private barbershop APIs."""

    message = SUSPENDED_BARBERSHOP_MESSAGE

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        if is_platform_admin_user(user):
            return True

        barber_shop = getattr(user, "barbershop", None)
        if not barber_shop:
            return True

        return barber_shop.status != BarberShop.Status.SUSPENDED
