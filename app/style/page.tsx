"use client";
import React from "react";
import { Moon, Sun } from "lucide-react";

const StyleGuide = () => {
  const [isDark, setIsDark] = React.useState(false);

  const toggleTheme = () => {
    setIsDark(!isDark);
  };

  React.useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark]);

  const ColorBlock: React.FC<{ label: string; variable: string }> = ({
    label,
    variable,
  }) => (
    <div className="flex flex-col gap-2">
      <div
        className={`h-16 w-full rounded-md border`}
        style={{ backgroundColor: `hsl(var(--${variable}))` }}
      />
      <div className="text-sm font-medium">
        {label}
        <span className="block text-muted-foreground">var(--{variable})</span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-6xl space-y-12">
        <div className="flex justify-between items-center">
          <h1 className="text-4xl font-bold text-foreground">Design System</h1>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-md bg-secondary hover:bg-secondary/80"
          >
            {isDark ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Typography */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground">Typography</h2>
          <div className="space-y-4 p-6 bg-card rounded-lg border">
            <h1 className="text-4xl font-bold">Heading 1</h1>
            <h2 className="text-3xl font-semibold">Heading 2</h2>
            <h3 className="text-2xl font-semibold">Heading 3</h3>
            <h4 className="text-xl font-semibold">Heading 4</h4>
            <p className="text-base">
              Base text with{" "}
              <span className="text-muted-foreground">muted variation</span>
            </p>
            <p className="text-sm">
              Small text with <span className="font-medium">medium weight</span>
            </p>
          </div>
        </section>

        {/* Colors */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground">Colors</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 p-6 bg-card rounded-lg border">
            <ColorBlock label="Background" variable="background" />
            <ColorBlock label="Foreground" variable="foreground" />
            <ColorBlock label="Primary" variable="primary" />
            <ColorBlock label="Secondary" variable="secondary" />
            <ColorBlock label="Muted" variable="muted" />
            <ColorBlock label="Accent" variable="accent" />
            <ColorBlock label="Destructive" variable="destructive" />
          </div>
        </section>

        {/* Components */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground">Components</h2>
          <div className="grid gap-8 p-6 bg-card rounded-lg border">
            {/* Buttons */}
            <div className="space-y-4">
              <h3 className="text-xl font-medium">Buttons</h3>
              <div className="flex flex-wrap gap-4">
                <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/50">
                  Primary
                </button>
                <button className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80">
                  Secondary
                </button>
                <button className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90">
                  Destructive
                </button>
                <button className="px-4 py-2 bg-muted text-muted-foreground rounded-md hover:bg-muted/80">
                  Muted
                </button>
              </div>
            </div>

            {/* Cards */}
            <div className="space-y-4">
              <h3 className="text-xl font-medium">Cards</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-6 bg-card rounded-lg border">
                  <h4 className="text-lg font-medium text-card-foreground">
                    Card Title
                  </h4>
                  <p className="text-muted-foreground">
                    Card content with muted text
                  </p>
                </div>
                <div className="p-6 bg-muted rounded-lg border">
                  <h4 className="text-lg font-medium">Muted Card</h4>
                  <p className="text-muted-foreground">
                    Alternative card style
                  </p>
                </div>
              </div>
            </div>

            {/* Form Elements */}
            <div className="space-y-4">
              <h3 className="text-xl font-medium">Form Elements</h3>
              <div className="grid gap-4">
                <input
                  type="text"
                  placeholder="Text input"
                  className="px-3 py-2 rounded-md border bg-background text-foreground"
                />
                <select className="px-3 py-2 rounded-md border bg-background text-foreground">
                  <option>Select option</option>
                  <option>Option 1</option>
                  <option>Option 2</option>
                </select>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="check"
                    className="rounded border-input"
                  />
                  <label htmlFor="check">Checkbox</label>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Charts */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground">
            Chart Colors
          </h2>
          <div className="grid grid-cols-5 gap-4 p-6 bg-card rounded-lg border">
            {[1, 2, 3, 4, 5].map((num) => (
              <div key={num} className="space-y-2">
                <div
                  className="h-16 rounded-md"
                  style={{ backgroundColor: `hsl(var(--chart-${num}))` }}
                />
                <p className="text-sm font-medium text-center">Chart {num}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default StyleGuide;
