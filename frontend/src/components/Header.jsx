import { useAuth } from "../context/AuthContext.jsx";

export default function Header() {
  const { barberShop, user } = useAuth();

  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">Painel da barbearia</p>
        <h1>{barberShop?.name || "BarberFlow"}</h1>
      </div>
      <div className="user-chip">
        <span>{user?.email || "Usuário"}</span>
      </div>
    </header>
  );
}
