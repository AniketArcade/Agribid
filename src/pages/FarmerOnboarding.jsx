import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import LandFields, { newLand } from '../components/LandFields';
import { updateUser, useApp } from '../lib/store';

export default function FarmerOnboarding() {
  const { me } = useApp();
  const navigate = useNavigate();
  const [lands, setLands] = useState(me.lands?.length ? me.lands : [newLand()]);

  function finish(e) {
    e.preventDefault();
    updateUser(me.id, {
      lands: lands.map((l) => ({ ...l, acres: Number(l.acres) })),
      profileComplete: true,
    });
    navigate('/farmer');
  }

  return (
    <div className="auth-shell">
      <header className="container landing-nav"><Logo /></header>
      <div className="card auth-card auth-wide">
        <form className="form" onSubmit={finish}>
          <h1>Your farm land</h1>
          <p className="muted">Add each piece of land you cultivate.</p>
          <LandFields lands={lands} onChange={setLands} />
          <button className="btn btn-primary btn-block">Finish & go to dashboard</button>
        </form>
      </div>
    </div>
  );
}
