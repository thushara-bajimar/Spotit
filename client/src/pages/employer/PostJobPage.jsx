import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react';
import { Button } from '../../components/ui/Button.jsx';
import { StateView } from '../../components/ui/StateView.jsx';
import { JobForm } from '../../components/employer/JobForm.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { createJobRequest } from '../../services/employerService.js';

export function PostJobPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const verification = user.employer?.verificationStatus;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold text-forest-900">{t('employer.postJob.title')}</h1>
      <p className="mt-1 text-muted">{t('employer.postJob.subtitle')}</p>

      <div className="mt-5">
        {verification !== 'approved' ? (
          // The API refuses too (403 EMPLOYER_NOT_APPROVED); this just explains it.
          <StateView
            variant="empty"
            title={t('employer.postJob.notApprovedTitle')}
            description={
              verification === 'rejected' ? t('employer.postJob.rejectedText') : t('employer.postJob.notApprovedText')
            }
            action={
              <Button as={Link} to="/employer/profile" variant="secondary">
                <Lock aria-hidden="true" className="size-4" />
                {t('employer.postJob.viewProfile')}
              </Button>
            }
          />
        ) : (
          <JobForm
            submitLabel={t('employer.postJob.submit')}
            onSubmit={async (payload) => {
              const job = await createJobRequest(payload);
              navigate(`/employer/jobs/${job.id}`, { state: { flash: 'created' } });
            }}
          />
        )}
      </div>
    </div>
  );
}
