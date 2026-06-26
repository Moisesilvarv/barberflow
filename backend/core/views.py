from django.db import IntegrityError
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework.decorators import api_view, permission_classes
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import Appointment, BarberShop
from .permissions import IsActiveBarberShop
from .serializers import (
    AVAILABLE_SLOTS,
    AppointmentSerializer,
    BarberShopSerializer,
    LoginSerializer,
    PublicAppointmentSerializer,
    RegisterSerializer,
    UserSerializer,
)


@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request):
    return Response(
        {
            "status": "ok",
            "message": "BarberFlow API is running",
        }
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    account = serializer.save()
    return Response(RegisterSerializer(account).data, status=status.HTTP_201_CREATED)


class LoginView(TokenObtainPairView):
    permission_classes = [AllowAny]
    serializer_class = LoginSerializer


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsActiveBarberShop])
def logout(request):
    refresh_token = request.data.get("refresh")
    if not refresh_token:
        return Response(
            {"detail": "Token de atualizacao e obrigatorio."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        token = RefreshToken(refresh_token)
        token.blacklist()
    except TokenError:
        return Response(
            {"detail": "Sessao expirada. Entre novamente."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return Response(status=status.HTTP_205_RESET_CONTENT)


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsActiveBarberShop])
def me(request):
    try:
        barber_shop = request.user.barbershop
    except BarberShop.DoesNotExist:
        return Response(
            {"detail": "Usuario autenticado nao possui uma barbearia vinculada."},
            status=status.HTTP_404_NOT_FOUND,
        )

    return Response(
        {
            "user": UserSerializer(request.user).data,
            "barber_shop": BarberShopSerializer(barber_shop).data,
        }
    )


class AppointmentListCreateView(ListCreateAPIView):
    serializer_class = AppointmentSerializer
    permission_classes = [IsAuthenticated, IsActiveBarberShop]

    def get_barber_shop(self):
        try:
            return self.request.user.barbershop
        except BarberShop.DoesNotExist as exc:
            raise ValidationError("Usuario autenticado nao possui uma barbearia vinculada.") from exc

    def get_queryset(self):
        queryset = Appointment.objects.filter(barber_shop=self.get_barber_shop()).order_by(
            "date",
            "time",
        )
        date_value = self.request.query_params.get("date")
        if date_value:
            parsed_date = parse_date(date_value)
            if not parsed_date:
                raise ValidationError({"date": "Informe uma data valida."})
            queryset = queryset.filter(date=parsed_date)
        return queryset

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["barber_shop"] = self.get_barber_shop()
        return context

    def perform_create(self, serializer):
        try:
            serializer.save(barber_shop=self.get_barber_shop())
        except IntegrityError as exc:
            raise ValidationError("Ja existe um agendamento para este horario.") from exc


class AppointmentDetailView(RetrieveUpdateDestroyAPIView):
    serializer_class = AppointmentSerializer
    permission_classes = [IsAuthenticated, IsActiveBarberShop]
    http_method_names = ["get", "patch", "delete", "head", "options"]

    def get_barber_shop(self):
        try:
            return self.request.user.barbershop
        except BarberShop.DoesNotExist as exc:
            raise ValidationError("Usuario autenticado nao possui uma barbearia vinculada.") from exc

    def get_queryset(self):
        return Appointment.objects.filter(barber_shop=self.get_barber_shop())

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["barber_shop"] = self.get_barber_shop()
        return context

    def perform_update(self, serializer):
        try:
            serializer.save()
        except IntegrityError as exc:
            raise ValidationError("Ja existe um agendamento para este horario.") from exc

    def perform_destroy(self, instance):
        instance.status = Appointment.Status.CANCELED
        instance.save(update_fields=["status"])


@api_view(["GET"])
@permission_classes([AllowAny])
def public_availability(request, barbershop_id):
    date_value = request.query_params.get("date")
    if not date_value:
        return Response(
            {"date": "Informe uma data para consultar os horarios."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    parsed_date = parse_date(date_value)
    if not parsed_date:
        return Response(
            {"date": "Informe uma data valida."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if parsed_date < timezone.localdate():
        return Response(
            {"date": "A data escolhida nao pode estar no passado."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        barber_shop = BarberShop.objects.get(pk=barbershop_id)
    except BarberShop.DoesNotExist:
        return Response(
            {"detail": "Barbearia nao encontrada."},
            status=status.HTTP_404_NOT_FOUND,
        )
    if barber_shop.status == BarberShop.Status.SUSPENDED:
        return Response(
            {"detail": "Esta barbearia esta temporariamente indisponivel."},
            status=status.HTTP_403_FORBIDDEN,
        )

    appointments = Appointment.objects.filter(
        barber_shop=barber_shop,
        date=parsed_date,
    ).exclude(status=Appointment.Status.CANCELED)
    available_base_slots = AVAILABLE_SLOTS

    if parsed_date == timezone.localdate():
        current_time = timezone.localtime().time()
        appointments = appointments.filter(time__gt=current_time)
        available_base_slots = [
            slot for slot in AVAILABLE_SLOTS if slot > current_time.strftime("%H:%M")
        ]

    occupied = list(appointments.order_by("time").values_list("time", flat=True))
    occupied_slots = [slot.strftime("%H:%M") for slot in occupied]
    available_slots = [slot for slot in available_base_slots if slot not in occupied_slots]

    return Response(
        {
            "barber_shop_id": barber_shop.id,
            "barber_shop_name": barber_shop.name,
            "date": parsed_date.isoformat(),
            "available": available_slots,
            "occupied": occupied_slots,
        }
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def public_appointment(request):
    serializer = PublicAppointmentSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    try:
        appointment = serializer.save()
    except IntegrityError as exc:
        raise ValidationError("Ja existe um agendamento para este horario.") from exc
    return Response(PublicAppointmentSerializer(appointment).data, status=status.HTTP_201_CREATED)
