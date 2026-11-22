import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Eye, IndianRupee, MapPin, Users } from 'lucide-react';
import { Card } from '../ui/Card.jsx';
import { Input } from '../ui/Input.jsx';
import { Select } from '../ui/Select.jsx';
import { Textarea } from '../ui/Textarea.jsx';
import { Button } from '../ui/Button.jsx';
import { Notice } from '../ui/Notice.jsx';
import { FormError } from '../forms/FormError.jsx';
import { DistrictSelect } from '../forms/DistrictSelect.jsx';
import { CategoryIcon } from '../common/CategoryIcon.jsx';
import { Wage } from '../jobs/Wage.jsx';
import { JobFacts } from '../jobs/JobFacts.jsx';
import { useForm } from '../../hooks/useForm.js';
import { useApiData } from '../../hooks/useApiData.js';
import { fetchCategories } from '../../services/categoryService.js';
import { fetchDistricts } from '../../services/referenceService.js';
import { checks, validate } from '../../utils/validation.js';
import { todayInIndia } from '../../utils/dates.js';
import { localName } from '../../utils/format.js';

const DURATIONS = ['few_hours', 'one_day', 'multiple_days', 'short_term'];
const WAGE_BASES = ['per_hour', 'per_day', 'per_week', 'per_task'];
const MULTI_DAY = ['multiple_days', 'short_term'];

export const EMPTY_JOB = {
  title: '',
  category: '',
  description: '',
  district: '',
  locality: '',
  address: '',
  durationType: 'one_day',
  startDate: '',
  endDate: '',
  startTime: '',
  endTime: '',
  wageAmount: '',
  wageBasis: 'per_day',
  workersRequired: '1',
  requirements: '',
};

/** Converts an employer job from the API into form values. */
export function jobToFormValues(job) {
  return {
    title: job.title,
    category: job.category.slug,
    description: job.description,
    district: job.district.id,
    locality: job.locality,
    address: job.address ?? '',
    durationType: job.durationType,
    startDate: job.startDate,
    endDate: job.endDate ?? '',
    startTime: job.startTime,
    endTime: job.endTime,
    wageAmount: String(job.wageAmount),
    wageBasis: job.wageBasis,
    workersRequired: String(job.workersRequired),
    requirements: job.requirements ?? '',
  };
}

const integerIn = (min, max) => (value) => {
  if (String(value ?? '').trim() === '') return 'required';
  const n = Number(value);
  if (!Number.isInteger(n)) return 'invalid';
  if (n < min) return 'too_small';
  if (n > max) return 'too_large';
  return null;
};

/** Client checks mirror the server rules (the server always re-checks). */
function validateJob(values, { originalStartDate }) {
  const today = todayInIndia();
  return validate(values, {
    title: checks.text(3, 120),
    category: checks.required,
    description: checks.text(10, 3000),
    district: checks.required,
    locality: checks.text(2, 100),
    durationType: checks.required,
    startDate: (v) => checks.required(v) ?? (v < today && v !== originalStartDate ? 'date_in_past' : null),
    endDate: (v, all) => {
      if (!MULTI_DAY.includes(all.durationType)) return null;
      if (!v) return 'end_date_required';
      return all.startDate && v <= all.startDate ? 'end_before_start' : null;
    },
    startTime: checks.required,
    endTime: (v, all) => checks.required(v) ?? (v === all.startTime ? 'same_time' : null),
    wageAmount: integerIn(1, 1000000),
    wageBasis: checks.required,
    workersRequired: integerIn(1, 100),
  });
}

/** Form values → API body (numbers as numbers, empty optionals left out). */
function toPayload(values) {
  return {
    ...values,
    wageAmount: Number(values.wageAmount),
    workersRequired: Number(values.workersRequired),
    endDate: MULTI_DAY.includes(values.durationType) ? values.endDate : undefined,
    address: values.address.trim() || undefined,
    requirements: values.requirements.trim() || undefined,
  };
}

/**
 * Create/edit job form with a preview step.
 * `onSubmit(payload)` must return a promise; API errors are shown on the form.
 */
export function JobForm({ initialValues = EMPTY_JOB, onSubmit, submitLabel, notice }) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage;
  const form = useForm(initialValues);
  const [step, setStep] = useState('edit');
  const categories = useApiData(fetchCategories);
  const districts = useApiData(fetchDistricts);
  const originalStartDate = initialValues.startDate || null;
  const { values } = form;
  const multiDay = MULTI_DAY.includes(values.durationType);

  const goToPreview = (event) =>
    form.submit(
      event,
      (v) => validateJob(v, { originalStartDate }),
      async () => {
        setStep('preview');
        window.scrollTo({ top: 0 });
      },
    );

  const publish = (event) =>
    form.submit(event, null, async (v) => {
      try {
        await onSubmit(toPayload(v));
      } catch (error) {
        setStep('edit'); // show field errors next to the fields
        throw error;
      }
    });

  if (step === 'preview') {
    const category = categories.data?.find((c) => c.slug === values.category);
    const district = districts.data?.find((d) => d.id === values.district);
    const previewJob = {
      ...toPayload(values),
      endDate: multiDay ? values.endDate : null,
      district: district ?? { id: values.district, nameEn: values.district, nameKn: values.district },
      vacancies: Number(values.workersRequired),
    };
    return (
      <form onSubmit={publish} className="space-y-5">
        <Notice>{t('employer.form.previewNote')}</Notice>
        <Card className="p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-forest-50 text-forest-700">
              <CategoryIcon name={category?.icon} className="size-6" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-muted">{category ? localName(category, language) : ''}</p>
              <p className="font-display text-2xl leading-snug font-bold text-forest-900">{values.title}</p>
            </div>
          </div>
          <Wage amount={previewJob.wageAmount} basis={previewJob.wageBasis} size="lg" className="mt-4" />
          <JobFacts job={previewJob} className="mt-4 border-t border-line pt-4 text-base" />
          <h3 className="mt-5 font-sans text-base font-bold text-ink">{t('jobDetails.about')}</h3>
          <p className="mt-1 whitespace-pre-line text-ink">{values.description}</p>
          {values.requirements.trim() && (
            <>
              <h3 className="mt-4 font-sans text-base font-bold text-ink">{t('jobDetails.requirements')}</h3>
              <p className="mt-1 whitespace-pre-line text-ink">{values.requirements}</p>
            </>
          )}
          {values.address.trim() && (
            <p className="mt-4 text-sm text-muted">
              {t('employer.form.address')}: {values.address} ({t('employer.form.addressPrivate')})
            </p>
          )}
        </Card>
        <FormError code={form.formError} />
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => setStep('edit')} disabled={form.submitting}>
            <ArrowLeft aria-hidden="true" className="size-4" />
            {t('employer.form.backToEdit')}
          </Button>
          <Button type="submit" size="lg" disabled={form.submitting}>
            {form.submitting ? t('employer.form.submitting') : submitLabel}
          </Button>
        </div>
      </form>
    );
  }

  const section = 'rounded-2xl border border-line bg-white p-5 sm:p-6 space-y-5';
  const sectionTitle = 'font-sans text-lg font-bold text-ink';

  return (
    <form onSubmit={goToPreview} noValidate className="space-y-5">
      {notice}
      <FormError code={form.formError} />

      <fieldset className={section}>
        <legend className="sr-only">{t('employer.form.sectionWork')}</legend>
        <h2 className={sectionTitle}>{t('employer.form.sectionWork')}</h2>
        <Input {...form.field('title')} label={t('employer.form.title')} hint={t('employer.form.titleHint')} maxLength={120} required />
        <Select
          {...form.field('category')}
          label={t('employer.form.category')}
          placeholder={t('common.select')}
          options={(categories.data ?? []).map((c) => ({ value: c.slug, label: localName(c, language) }))}
          required
        />
        <Textarea
          {...form.field('description')}
          label={t('employer.form.description')}
          hint={t('employer.form.descriptionHint')}
          maxLength={3000}
          rows={5}
          required
        />
        <Textarea
          {...form.field('requirements')}
          label={t('employer.form.requirements')}
          optionalLabel={t('common.optional')}
          hint={t('employer.form.requirementsHint')}
          maxLength={1000}
        />
      </fieldset>

      <fieldset className={section}>
        <legend className="sr-only">{t('employer.form.sectionPlace')}</legend>
        <h2 className={sectionTitle}>{t('employer.form.sectionPlace')}</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <DistrictSelect {...form.field('district')} required />
          <Input {...form.field('locality')} label={t('auth.fields.locality')} icon={MapPin} maxLength={100} required />
        </div>
        <Input
          {...form.field('address')}
          label={t('employer.form.address')}
          optionalLabel={t('common.optional')}
          hint={t('employer.form.addressHint')}
          maxLength={300}
        />
      </fieldset>

      <fieldset className={section}>
        <legend className="sr-only">{t('employer.form.sectionWhen')}</legend>
        <h2 className={sectionTitle}>{t('employer.form.sectionWhen')}</h2>
        <Select
          {...form.field('durationType')}
          label={t('employer.form.duration')}
          hint={t('employer.form.durationHint')}
          options={DURATIONS.map((d) => ({ value: d, label: t(`duration.${d}`) }))}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            {...form.field('startDate')}
            label={multiDay ? t('employer.form.startDate') : t('employer.form.workDate')}
            type="date"
            min={todayInIndia()}
            required
          />
          {multiDay && (
            <Input {...form.field('endDate')} label={t('employer.form.endDate')} type="date" min={values.startDate || todayInIndia()} required />
          )}
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Input {...form.field('startTime')} label={t('employer.form.startTime')} type="time" required />
          <Input {...form.field('endTime')} label={t('employer.form.endTime')} type="time" hint={t('employer.form.timeHint')} required />
        </div>
      </fieldset>

      <fieldset className={section}>
        <legend className="sr-only">{t('employer.form.sectionPay')}</legend>
        <h2 className={sectionTitle}>{t('employer.form.sectionPay')}</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            {...form.field('wageAmount')}
            label={t('employer.form.wageAmount')}
            icon={IndianRupee}
            type="number"
            inputMode="numeric"
            min={1}
            required
          />
          <Select
            {...form.field('wageBasis')}
            label={t('employer.form.wageBasis')}
            options={WAGE_BASES.map((b) => ({ value: b, label: t(`jobs.filters.basis.${b}`) }))}
          />
        </div>
        <Input
          {...form.field('workersRequired')}
          label={t('employer.form.workersRequired')}
          icon={Users}
          type="number"
          inputMode="numeric"
          min={1}
          max={100}
          className="sm:max-w-xs"
          required
        />
      </fieldset>

      <div className="flex justify-end">
        <Button type="submit" size="lg" className="w-full sm:w-auto">
          <Eye aria-hidden="true" className="size-5" />
          {t('employer.form.preview')}
        </Button>
      </div>
    </form>
  );
}
