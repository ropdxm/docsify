import { field, label } from "@/lib/ui";

/**
 * Manual requisites entry, shared by signup and onboarding. Inputs carry `name`
 * attributes so they post with the surrounding <form>.
 */
export function RequisitesFields({
  fieldErrors,
}: {
  fieldErrors?: Record<string, string[]>;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className={label} htmlFor="bin">
          Ваш БИН / ИИН
        </label>
        <input
          id="bin"
          name="bin"
          inputMode="numeric"
          maxLength={12}
          placeholder="12 цифр"
          className={`${field} font-mono tracking-wider`}
        />
        {fieldErrors?.bin && (
          <p className="mt-1 text-sm text-danger">{fieldErrors.bin[0]}</p>
        )}
      </div>

      <div>
        <label className={label} htmlFor="name">
          Название компании
        </label>
        <input
          id="name"
          name="name"
          placeholder="ТОО «...» или ИП"
          className={field}
        />
        {fieldErrors?.name && (
          <p className="mt-1 text-sm text-danger">{fieldErrors.name[0]}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="director">
            Руководитель
          </label>
          <input id="director" name="director" className={field} />
        </div>
        <div>
          <label className={label} htmlFor="address">
            Адрес
          </label>
          <input id="address" name="address" className={field} />
        </div>
      </div>
    </div>
  );
}
