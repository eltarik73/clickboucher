import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FormWizard, WizardStep } from "@/components/ui/FormWizard";

const baseSteps: WizardStep[] = [
  {
    id: "a",
    title: "Step A",
    content: <div>Content A</div>,
    isValid: () => true,
  },
  {
    id: "b",
    title: "Step B",
    content: <div>Content B</div>,
    isValid: () => true,
  },
];

describe("FormWizard", () => {
  test("renders first step", () => {
    render(<FormWizard steps={baseSteps} onComplete={() => {}} />);
    expect(screen.getByText("Content A")).toBeInTheDocument();
    expect(screen.getByText("Step A")).toBeInTheDocument();
  });

  test("advances to next step on Suivant click", () => {
    render(<FormWizard steps={baseSteps} onComplete={() => {}} />);
    fireEvent.click(screen.getByText(/Suivant/));
    expect(screen.getByText("Content B")).toBeInTheDocument();
  });

  test("calls onComplete on last step", () => {
    const onComplete = vi.fn();
    render(
      <FormWizard
        steps={baseSteps}
        onComplete={onComplete}
        initialStep={1}
      />
    );
    fireEvent.click(screen.getByText(/Confirmer/));
    expect(onComplete).toHaveBeenCalled();
  });

  test("disables Suivant when isValid returns false", () => {
    const blockedSteps: WizardStep[] = [
      {
        id: "a",
        title: "Step A",
        content: <div>A</div>,
        isValid: () => false,
      },
      ...baseSteps.slice(1),
    ];
    render(<FormWizard steps={blockedSteps} onComplete={() => {}} />);
    expect(screen.getByText(/Suivant/).closest("button")).toBeDisabled();
  });

  test("Précédent is disabled on first step", () => {
    render(<FormWizard steps={baseSteps} onComplete={() => {}} />);
    expect(screen.getByText(/Précédent/).closest("button")).toBeDisabled();
  });

  test("Précédent navigates back", () => {
    render(
      <FormWizard
        steps={baseSteps}
        onComplete={() => {}}
        initialStep={1}
      />
    );
    fireEvent.click(screen.getByText(/Précédent/));
    expect(screen.getByText("Content A")).toBeInTheDocument();
  });
});
