import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowRight, MapPin, Search } from 'lucide-react';
import { Card } from '../../components/ui/Card.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useApiData } from '../../hooks/useApiData.js';
import { fetchMyApplications } from '../../services/workerService.js';
import { fetchDistricts } from '../../services/referenceService.js';
import { localName } from '../../utils/format.js';

const fetchAllApplications = ({ signal }) => fetchMyApplications('', { signal });
const SUMMARY = ['pending', 'accepted', 'rejected', 'withdrawn'];

/** Worker home: quick search, shortcuts and an application summary. */
export function WorkerHomePage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const applications = useApiData(fetchAllApplications);
  const districts = useApiData(fetchDistricts);

  const myDistrict = districts.data?.find((d) => d.id === user.district);
  const firstName = user.fullName.split(' ')[0];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-forest-900">{t('workerHome.title', { name: firstName })}</h1>
        <p className="mt-1 text-muted">{t('workerHome.subtitle')}</p>
      </div>

      <Card className="p-5">
        <form
          role="search"
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const q = query.trim();
            navigate(q ? `/worker/jobs?q=${encodeURIComponent(q)}` : '/worker/jobs');
          }}
        >
          <Input
            label={t('jobs.searchLabel')}
            className="flex-1 [&>label]:sr-only"
            icon={Search}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('jobs.searchPlaceholder')}
            maxLength={100}
          />
          <Button type="submit" className="shrink-0">
            {t('jobs.search')}
          </Button>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button as={Link} to="/worker/jobs" variant="secondary" size="sm">
            {t('workerHome.browseAll')}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Button>
          {user.district && (
            <Button
              as={Link}
              to={`/worker/jobs?district=${encodeURIComponent(user.district)}`}
              variant="secondary"
              size="sm"
            >
              <MapPin aria-hidden="true" className="size-4" />
              {t('workerHome.jobsInDistrict', {
                district: myDistrict ? localName(myDistrict, i18n.resolvedLanguage) : user.district,
              })}
            </Button>
          )}
        </div>
      </Card>

      <section aria-labelledby="summary-title">
        <div className="flex items-center justify-between gap-3">
          <h2 id="summary-title" className="text-2xl font-bold text-forest-900">
            {t('workerHome.summaryTitle')}
          </h2>
          <Link to="/worker/my-work" className="text-sm font-semibold text-forest-700 hover:underline">
            {t('workerHome.viewAll')}
          </Link>
        </div>
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SUMMARY.map((status) => (
            <li key={status}>
              <Link
                to={`/worker/my-work?status=${status}`}
                className="flex flex-col rounded-2xl border border-line bg-white p-4 hover:border-forest-300"
              >
                <span className="font-display text-3xl font-bold text-forest-800">
                  {applications.data ? applications.data.counts[status] : '–'}
                </span>
                <span className="text-sm font-semibold text-muted">{t(`applicationStatus.${status}`)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
