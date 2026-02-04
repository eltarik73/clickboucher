"use client";

import React from "react";
import {
  Briefcase,
  Store,
  ArrowRight,
  Shield,
  CreditCard,
  Clock,
  Users,
  ChefHat,
} from "lucide-react";
import { ClientHeader } from "@/components/layout/client-header";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function ProPage() {
  return (
    <PageContainer>
      <ClientHeader title="Espace Pro" showLocation={false} showCart={false} />

      <div className="px-4 py-6 space-y-8">
        {/* ── Section A: Client Pro ─── */}
        <section className="animate-fade-up">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
              <Briefcase size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="font-display text-subtitle">
                Vous êtes un client pro ?
              </h2>
              <p className="text-caption text-muted-foreground">
                Restaurateurs, traiteurs, collectivités
              </p>
            </div>
          </div>

          <div className="premium-card p-5 space-y-4">
            <div className="space-y-3">
              {[
                {
                  icon: CreditCard,
                  title: "Tarifs PRO dédiés",
                  desc: "Prix négociés inférieurs aux prix publics",
                },
                {
                  icon: Clock,
                  title: "Compte client",
                  desc: "Paiement à échéance, activable par votre boucher",
                },
                {
                  icon: Shield,
                  title: "Validation SIRET",
                  desc: "Accès PRO après vérification par le commerçant",
                },
              ].map((feature) => (
                <div key={feature.title} className="flex items-start gap-3">
                  <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-muted flex-shrink-0">
                    <feature.icon
                      size={18}
                      className="text-muted-foreground"
                    />
                  </div>
                  <div>
                    <h4 className="text-caption font-semibold">
                      {feature.title}
                    </h4>
                    <p className="text-micro text-muted-foreground">
                      {feature.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <Button className="w-full" size="lg">
              <span>Demander l&apos;accès PRO</span>
              <ArrowRight size={18} className="ml-2" />
            </Button>

            <p className="text-micro text-muted-foreground text-center">
              SIRET requis • Validation sous 24-48h
            </p>
          </div>
        </section>

        <Separator />

        {/* ── Section B: Boucher ─── */}
        <section className="animate-fade-up" style={{ animationDelay: "150ms" }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-accent/10">
              <Store size={20} className="text-accent" />
            </div>
            <div>
              <h2 className="font-display text-subtitle">
                Vous êtes boucher ?
              </h2>
              <p className="text-caption text-muted-foreground">
                Ajoutez votre commerce sur ClickBoucher
              </p>
            </div>
          </div>

          <div className="premium-card p-5 space-y-4 border-accent/20">
            <div className="space-y-3">
              {[
                {
                  icon: Users,
                  title: "Nouveaux clients",
                  desc: "Développez votre clientèle locale et pro",
                },
                {
                  icon: ChefHat,
                  title: "Back-office complet",
                  desc: "Gérez commandes, stocks et dernières minutes",
                },
                {
                  icon: Store,
                  title: "Click & Collect",
                  desc: "Vos clients commandent, vous préparez",
                },
              ].map((feature) => (
                <div key={feature.title} className="flex items-start gap-3">
                  <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-accent/5 flex-shrink-0">
                    <feature.icon size={18} className="text-accent" />
                  </div>
                  <div>
                    <h4 className="text-caption font-semibold">
                      {feature.title}
                    </h4>
                    <p className="text-micro text-muted-foreground">
                      {feature.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <Button variant="outline" className="w-full border-accent/30 text-accent hover:bg-accent/5" size="lg">
              <span>Ajouter votre commerce</span>
              <ArrowRight size={18} className="ml-2" />
            </Button>

            <p className="text-micro text-muted-foreground text-center">
              Inscription gratuite • Mise en ligne en 24h
            </p>
          </div>
        </section>

        {/* ── Pro badge info ─── */}
        <div className="flex items-center justify-center gap-2 py-4">
          <Badge variant="pro">PRO</Badge>
          <span className="text-micro text-muted-foreground">
            Tarifs et fonctionnalités réservés aux professionnels
          </span>
        </div>
      </div>
    </PageContainer>
  );
}
