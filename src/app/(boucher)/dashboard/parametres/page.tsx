"use client";

import React, { useState } from "react";
import {
  Store, Clock, CreditCard, Bell, Shield, MapPin, Phone, Globe,
  Camera, Check, ChevronRight, Banknote, Smartphone, Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface SettingsSection {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

function Section({ title, icon, children }: SettingsSection) {
  return (
    <div className="premium-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
          {icon}
        </div>
        <h3 className="font-display font-semibold text-sm">{title}</h3>
      </div>
      {children}
    </div>
  );
}

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

export default function BoucherParametresPage() {
  const [shopName, setShopName] = useState("Boucherie Savoie Tradition");
  const [address, setAddress] = useState("12 Rue de Boigne, 73000 Chambéry");
  const [phone, setPhone] = useState("04 79 33 12 34");
  const [description, setDescription] = useState("Boucherie artisanale depuis 1987. Viande locale maturée, charcuterie maison.");

  const [hours] = useState(
    DAYS.map((day, i) => ({
      day,
      open: i < 5 ? "08:00" : i === 5 ? "07:30" : "",
      close: i < 5 ? "19:00" : i === 5 ? "13:00" : "",
      isClosed: i === 6,
    }))
  );

  const [allowCash, setAllowCash] = useState(true);
  const [allowCard, setAllowCard] = useState(true);
  const [allowOnline, setAllowOnline] = useState(true);

  const [notifSms, setNotifSms] = useState(true);
  const [notifWhatsapp, setNotifWhatsapp] = useState(false);
  const [notifPush, setNotifPush] = useState(false);

  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="px-4 py-4 space-y-4 pb-24">
      {/* Shop Info */}
      <Section title="Informations boutique" icon={<Store size={16} />}>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Nom</label>
            <Input value={shopName} onChange={(e) => setShopName(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Adresse</label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Téléphone</label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm resize-none"
            />
          </div>
          <Button variant="outline" className="w-full gap-1">
            <Camera size={14} />
            Changer la photo de couverture
          </Button>
        </div>
      </Section>

      {/* Opening Hours */}
      <Section title="Horaires d'ouverture" icon={<Clock size={16} />}>
        <div className="space-y-2">
          {hours.map((h) => (
            <div key={h.day} className="flex items-center justify-between text-sm">
              <span className={`w-20 ${h.isClosed ? "text-muted-foreground" : ""}`}>{h.day}</span>
              {h.isClosed ? (
                <Badge variant="secondary" className="text-xs">Fermé</Badge>
              ) : (
                <div className="flex items-center gap-2">
                  <Input value={h.open} className="w-20 h-8 text-center text-xs" readOnly />
                  <span className="text-muted-foreground">—</span>
                  <Input value={h.close} className="w-20 h-8 text-center text-xs" readOnly />
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* Payment Methods */}
      <Section title="Modes de paiement" icon={<CreditCard size={16} />}>
        <div className="space-y-2">
          {[
            { label: "Espèces au retrait", icon: Banknote, checked: allowCash, toggle: setAllowCash },
            { label: "CB au retrait", icon: CreditCard, checked: allowCard, toggle: setAllowCard },
            { label: "CB en ligne (Stripe)", icon: Globe, checked: allowOnline, toggle: setAllowOnline },
          ].map((method) => (
            <label key={method.label} className="flex items-center justify-between p-2 rounded-xl hover:bg-muted/50 cursor-pointer">
              <div className="flex items-center gap-2">
                <method.icon size={16} className="text-muted-foreground" />
                <span className="text-sm">{method.label}</span>
              </div>
              <div
                className={`w-10 h-6 rounded-full transition-colors cursor-pointer flex items-center ${method.checked ? "bg-primary" : "bg-muted"}`}
                onClick={(e) => { e.preventDefault(); method.toggle(!method.checked); }}
              >
                <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${method.checked ? "translate-x-[18px]" : "translate-x-[2px]"}`} />
              </div>
            </label>
          ))}
        </div>
      </Section>

      {/* Notifications */}
      <Section title="Notifications client" icon={<Bell size={16} />}>
        <p className="text-xs text-muted-foreground">Canaux utilisés pour notifier les clients de l&apos;avancement de leur commande.</p>
        <div className="space-y-2">
          {[
            { label: "SMS", icon: Smartphone, checked: notifSms, toggle: setNotifSms },
            { label: "WhatsApp", icon: Phone, checked: notifWhatsapp, toggle: setNotifWhatsapp },
            { label: "Notifications push", icon: Bell, checked: notifPush, toggle: setNotifPush },
          ].map((channel) => (
            <label key={channel.label} className="flex items-center justify-between p-2 rounded-xl hover:bg-muted/50 cursor-pointer">
              <div className="flex items-center gap-2">
                <channel.icon size={16} className="text-muted-foreground" />
                <span className="text-sm">{channel.label}</span>
              </div>
              <div
                className={`w-10 h-6 rounded-full transition-colors cursor-pointer flex items-center ${channel.checked ? "bg-primary" : "bg-muted"}`}
                onClick={(e) => { e.preventDefault(); channel.toggle(!channel.checked); }}
              >
                <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${channel.checked ? "translate-x-[18px]" : "translate-x-[2px]"}`} />
              </div>
            </label>
          ))}
        </div>
      </Section>

      {/* Tolerance */}
      <Section title="Sécurité & Tolérance" icon={<Shield size={16} />}>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Tolérance poids</span>
            <Badge variant="outline">±10%</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Au-delà de +10%, le client doit valider le nouveau prix. En dessous de -10%, le boucher doit compléter.
          </p>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Rétention panier DM</span>
            <Badge variant="outline">10 min</Badge>
          </div>
        </div>
      </Section>

      {/* Save Button */}
      <div className="fixed bottom-0 left-0 right-0 glass border-t border-border p-4">
        <div className="max-w-3xl mx-auto">
          <Button className="w-full h-12 gap-2" onClick={handleSave}>
            {saved ? (
              <>
                <Check size={18} />
                Enregistré !
              </>
            ) : (
              "Enregistrer les modifications"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
