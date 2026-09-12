import {
  Construction,
} from 'lucide-react';

interface PlaceholderPageProps {
  title: string;
  description: string;
}

function PlaceholderPage({
  title,
  description,
}: PlaceholderPageProps) {
  return (
    <main className="dashboard-content">
      <section className="dashboard-heading">
        <div>
          <h2>
            {title}
          </h2>

          <p>
            {description}
          </p>
        </div>
      </section>

      <section className="panel">
        <div className="empty-state">
          <Construction
            size={34}
          />

          <strong>
            Módulo em desenvolvimento
          </strong>

          <span>
            Esta área será conectada
            aos recursos financeiros
            do FinPilot.
          </span>
        </div>
      </section>
    </main>
  );
}

export default PlaceholderPage;