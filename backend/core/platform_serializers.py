from rest_framework import serializers

from .models import BarberShop


class PlatformBarberShopListSerializer(serializers.ModelSerializer):
    """Serializer used by the platform admin list endpoint."""

    owner_name = serializers.SerializerMethodField()
    owner_email = serializers.EmailField(source="user.email", read_only=True)
    last_login = serializers.DateTimeField(source="user.last_login", read_only=True)
    appointments_count = serializers.IntegerField(read_only=True)
    services_count = serializers.IntegerField(read_only=True)
    clients_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = BarberShop
        fields = (
            "id",
            "name",
            "owner_name",
            "owner_email",
            "status",
            "plan",
            "created_at",
            "last_login",
            "appointments_count",
            "services_count",
            "clients_count",
        )

    def get_owner_name(self, barber_shop):
        return barber_shop.user.get_full_name() or barber_shop.user.username


class PlatformBarberShopDetailSerializer(serializers.ModelSerializer):
    """Serializer used by the platform admin detail endpoint."""

    owner = serializers.SerializerMethodField()
    metrics = serializers.SerializerMethodField()
    latest_appointments = serializers.SerializerMethodField()
    services = serializers.SerializerMethodField()
    public_link = serializers.SerializerMethodField()

    class Meta:
        model = BarberShop
        fields = (
            "id",
            "name",
            "email",
            "city",
            "status",
            "plan",
            "created_at",
            "updated_at",
            "owner",
            "metrics",
            "latest_appointments",
            "services",
            "public_link",
        )

    def get_owner(self, barber_shop):
        user = barber_shop.user
        return {
            "id": user.id,
            "name": user.get_full_name() or user.username,
            "email": user.email,
            "last_login": user.last_login,
        }

    def get_metrics(self, barber_shop):
        return {
            "total_appointments": getattr(barber_shop, "appointments_count", 0),
            "appointments_today": getattr(barber_shop, "appointments_today_count", 0),
            "appointments_this_month": getattr(barber_shop, "appointments_this_month_count", 0),
            "total_clients": getattr(barber_shop, "clients_count", 0),
            "total_services": getattr(barber_shop, "services_count", 0),
        }

    def get_latest_appointments(self, barber_shop):
        appointments = barber_shop.appointments.order_by("-date", "-time", "-id")[:10]
        return [
            {
                "id": appointment.id,
                "client_name": appointment.client_name,
                "client_phone": appointment.client_phone,
                "date": appointment.date,
                "time": appointment.time,
                "status": appointment.status,
                "created_at": appointment.created_at,
            }
            for appointment in appointments
        ]

    def get_services(self, barber_shop):
        services = getattr(barber_shop, "prefetched_services", None)
        if services is None:
            services = barber_shop.services.order_by("name", "id")

        return [
            {
                "id": service.id,
                "name": service.name,
                "price": service.price,
                "created_at": service.created_at,
            }
            for service in services
        ]

    def get_public_link(self, barber_shop):
        return f"/public/{barber_shop.id}"
