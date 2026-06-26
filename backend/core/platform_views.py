from django.contrib.auth.models import User
from django.db.models import Count, Prefetch, Q
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Appointment, BarberShop, Client, Service
from .permissions import IsPlatformAdmin
from .platform_serializers import (
    PlatformBarberShopDetailSerializer,
    PlatformBarberShopListSerializer,
)


PLATFORM_PERMISSIONS = [IsAuthenticated, IsPlatformAdmin]


class PlatformPagination(PageNumberPagination):
    """Default pagination for platform admin resources."""

    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 100


def normalize_choice(value, choices):
    """Normalizes API filters while keeping database values lowercase."""

    if not value:
        return None

    normalized_value = value.strip().lower()
    allowed_values = {choice_value for choice_value, _ in choices}
    return normalized_value if normalized_value in allowed_values else None


def barbershop_admin_queryset(include_services=False):
    """Shared optimized queryset for platform barbershop management endpoints."""

    today = timezone.localdate()
    month_start = today.replace(day=1)

    queryset = (
        BarberShop.objects.select_related("user")
        .annotate(
            clients_count=Count("clients", distinct=True),
            appointments_count=Count("appointments", distinct=True),
            services_count=Count("services", distinct=True),
            appointments_today_count=Count(
                "appointments",
                filter=Q(appointments__date=today),
                distinct=True,
            ),
            appointments_this_month_count=Count(
                "appointments",
                filter=Q(appointments__date__gte=month_start, appointments__date__lte=today),
                distinct=True,
            ),
        )
    )

    if include_services:
        queryset = queryset.prefetch_related(
            Prefetch(
                "services",
                queryset=Service.objects.order_by("name", "id"),
                to_attr="prefetched_services",
            )
        )

    return queryset


@api_view(["GET"])
@permission_classes(PLATFORM_PERMISSIONS)
def platform_dashboard(request):
    """Returns complete platform metrics for the future SaaS admin dashboard."""

    today = timezone.localdate()
    month_start = today.replace(day=1)
    growth_start = today - timezone.timedelta(days=29)

    barbershop_metrics = BarberShop.objects.aggregate(
        total_barbershops=Count("id"),
        active_barbershops=Count("id", filter=Q(status=BarberShop.Status.ACTIVE)),
        suspended_barbershops=Count("id", filter=Q(status=BarberShop.Status.SUSPENDED)),
        new_barbershops_this_month=Count("id", filter=Q(created_at__date__gte=month_start)),
    )
    appointment_metrics = Appointment.objects.aggregate(
        total=Count("id"),
        today=Count("id", filter=Q(date=today)),
        this_month=Count("id", filter=Q(date__gte=month_start, date__lte=today)),
    )
    appointments_by_day = (
        Appointment.objects.filter(date__gte=growth_start, date__lte=today)
        .values("date")
        .annotate(count=Count("id"))
        .order_by("date")
    )
    appointments_count_by_day = {
        item["date"].isoformat(): item["count"]
        for item in appointments_by_day
        if item["date"]
    }

    appointments_last_30_days = []
    for offset in range(30):
        day = growth_start + timezone.timedelta(days=offset)
        day_key = day.isoformat()
        appointments_last_30_days.append(
            {
                "date": day_key,
                "count": appointments_count_by_day.get(day_key, 0),
            }
        )

    recent_barbershops = list(
        BarberShop.objects.order_by("-created_at", "-id").values(
            "id",
            "name",
            "created_at",
            "status",
        )[:5]
    )

    return Response(
        {
            "platform": {
                "total_barbershops": barbershop_metrics["total_barbershops"],
                "active_barbershops": barbershop_metrics["active_barbershops"],
                "suspended_barbershops": barbershop_metrics["suspended_barbershops"],
                "new_barbershops_this_month": barbershop_metrics["new_barbershops_this_month"],
            },
            "users": {
                "total_users": User.objects.count(),
            },
            "appointments": {
                "total": appointment_metrics["total"],
                "today": appointment_metrics["today"],
                "this_month": appointment_metrics["this_month"],
            },
            "services": {
                "total": Service.objects.count(),
            },
            "clients": {
                "total": Client.objects.count(),
            },
            "growth": {
                "appointments_last_30_days": appointments_last_30_days,
            },
            "recent_barbershops": recent_barbershops,
        }
    )


class PlatformBarberShopListView(ListAPIView):
    """Lists all barbershops for platform admins with search, filters and pagination."""

    serializer_class = PlatformBarberShopListSerializer
    permission_classes = PLATFORM_PERMISSIONS
    pagination_class = PlatformPagination

    def get_queryset(self):
        queryset = barbershop_admin_queryset()
        search = self.request.query_params.get("search", "").strip()
        status_filter = normalize_choice(self.request.query_params.get("status"), BarberShop.Status.choices)
        plan_filter = normalize_choice(self.request.query_params.get("plan"), BarberShop.Plan.choices)

        if search:
            queryset = queryset.filter(Q(name__icontains=search) | Q(user__email__icontains=search))

        if status_filter:
            queryset = queryset.filter(status=status_filter)

        if plan_filter:
            queryset = queryset.filter(plan=plan_filter)

        return queryset.order_by("-created_at", "-id")


class PlatformBarberShopDetailView(RetrieveAPIView):
    """Returns operational details for one barbershop."""

    serializer_class = PlatformBarberShopDetailSerializer
    permission_classes = PLATFORM_PERMISSIONS

    def get_queryset(self):
        return barbershop_admin_queryset(include_services=True)


@api_view(["PATCH"])
@permission_classes(PLATFORM_PERMISSIONS)
def suspend_barber_shop(request, pk):
    """Suspends a barbershop without deleting any user or tenant data."""

    try:
        barber_shop = BarberShop.objects.get(pk=pk)
    except BarberShop.DoesNotExist:
        return Response({"detail": "Barbearia nao encontrada."}, status=status.HTTP_404_NOT_FOUND)

    if barber_shop.status == BarberShop.Status.SUSPENDED:
        detail = "Barbearia ja estava suspensa."
    else:
        detail = "Barbearia suspensa com sucesso."
        barber_shop.status = BarberShop.Status.SUSPENDED
        barber_shop.suspended_at = timezone.now()
        barber_shop.suspended_by = request.user
        barber_shop.save(update_fields=["status", "suspended_at", "suspended_by", "updated_at"])

    barber_shop.refresh_from_db()
    return Response(
        {
            "detail": detail,
            "barbershop": {
                "id": barber_shop.id,
                "name": barber_shop.name,
                "status": barber_shop.status.upper(),
            },
        }
    )


@api_view(["PATCH"])
@permission_classes(PLATFORM_PERMISSIONS)
def reactivate_barber_shop(request, pk):
    """Reactivates a suspended barbershop without changing its tenant data."""

    try:
        barber_shop = BarberShop.objects.get(pk=pk)
    except BarberShop.DoesNotExist:
        return Response({"detail": "Barbearia nao encontrada."}, status=status.HTTP_404_NOT_FOUND)

    if barber_shop.status == BarberShop.Status.ACTIVE:
        detail = "Barbearia ja estava ativa."
    else:
        detail = "Barbearia reativada com sucesso."
        barber_shop.status = BarberShop.Status.ACTIVE
        barber_shop.reactivated_at = timezone.now()
        barber_shop.save(update_fields=["status", "reactivated_at", "updated_at"])

    barber_shop.refresh_from_db()
    return Response(
        {
            "detail": detail,
            "barbershop": {
                "id": barber_shop.id,
                "name": barber_shop.name,
                "status": barber_shop.status.upper(),
            },
        }
    )
