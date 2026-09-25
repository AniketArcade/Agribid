import Field from './Field';

export const newLand = () => ({ id: Math.random().toString(36).slice(2), location: '', area: '', acres: '' });

/** Editable list of land parcels, shared by onboarding and profile. */
export default function LandFields({ lands, onChange }) {
  const update = (id, key, value) => onChange(lands.map((l) => (l.id === id ? { ...l, [key]: value } : l)));
  const remove = (id) => onChange(lands.filter((l) => l.id !== id));

  return (
    <div className="land-list">
      {lands.map((land, i) => (
        <fieldset key={land.id} className="land-item">
          <legend>
            Land {i + 1}
            {lands.length > 1 && (
              <button type="button" className="link-btn danger" onClick={() => remove(land.id)}>Remove</button>
            )}
          </legend>
          <Field label="Land location" placeholder="Village / survey or gat number"
            value={land.location} onChange={(e) => update(land.id, 'location', e.target.value)} required />
          <div className="grid-2">
            <Field label="Area / locality" placeholder="e.g. Near canal road, Plot 4"
              value={land.area} onChange={(e) => update(land.id, 'area', e.target.value)} required />
            <Field label="Size (acres)" type="number" min="0.1" step="0.1" placeholder="e.g. 5"
              value={land.acres} onChange={(e) => update(land.id, 'acres', e.target.value)} required />
          </div>
        </fieldset>
      ))}
      <button type="button" className="btn btn-outline btn-sm" onClick={() => onChange([...lands, newLand()])}>
        + Add another land
      </button>
    </div>
  );
}
