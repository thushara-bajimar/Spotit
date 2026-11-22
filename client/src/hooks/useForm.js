import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Minimal form state for SpotIt forms.
 *   const form = useForm({ phone: '' });
 *   <Input {...form.field('phone')} />
 *   <form onSubmit={(e) => form.submit(e, validateFn, async (values) => {...})}>
 *
 * - Client errors are shown before anything is sent.
 * - Server VALIDATION_ERROR / PHONE_TAKEN details become field errors.
 * - Any other server error becomes `formError` (an error code).
 */
export function useForm(initialValues) {
  const { t } = useTranslation();
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const setValue = useCallback((name, value) => {
    setValues((previous) => ({ ...previous, [name]: value }));
    setErrors((previous) => (previous[name] ? { ...previous, [name]: undefined } : previous));
  }, []);

  /** Props for an <Input>/<Select> bound to `name`. */
  const field = (name) => ({
    name,
    value: values[name],
    onChange: (event) => setValue(name, event.target.value),
    error: errors[name] ? t(`validation.${errors[name]}`, { defaultValue: t('validation.invalid') }) : undefined,
  });

  const focusFirstError = (formElement) => {
    requestAnimationFrame(() => formElement?.querySelector('[aria-invalid="true"]')?.focus());
  };

  async function submit(event, validateValues, action) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const clientErrors = validateValues ? validateValues(values) : {};

    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      setFormError(null);
      focusFirstError(formElement);
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      await action(values);
    } catch (error) {
      if (Array.isArray(error.details) && error.details.length > 0) {
        setErrors(Object.fromEntries(error.details.map(({ field: name, code }) => [name, code])));
        // An error on a field this form does not show still needs a visible message.
        if (error.details.some(({ field: name }) => !(name in values))) setFormError(error.code);
        focusFirstError(formElement);
      } else {
        setFormError(error.code ?? 'generic');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return { values, setValue, field, errors, formError, submitting, submit };
}
