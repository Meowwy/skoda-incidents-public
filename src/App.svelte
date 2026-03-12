<script>
  import schemaData from "./assets/compiled-schema.json";

  let schema = schemaData;

  // ==========================================
  // STATE
  // ==========================================
  let phase = $state('location'); // 'location' | 'system' | 'finished'
  let selectedArea = $state('Logistika');
  let selectedSubarea = $state('Inhouse');
  let selectedLocation = $state(null);
  let selectedWarehouse = $state(null);
  let additionalInfo = $state('');
  let selectedSystem = $state(null);
  let answers = $state({});
  let currentStepIndex = $state(-1);
  let history = $state([]);
  let isFinished = $state(false);
  let finalResult = $state(null);

  // ==========================================
  // STATIC DATA
  // ==========================================
  const locations = ['MB', 'KV', 'VR', 'Teplice', 'EDL MB', 'EDL KV'];

  const warehouseMap = {
    'MB': ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8'],
    'KV': ['K1', 'K2', 'K3', 'K4', 'K5', 'K6'],
    'VR': ['V1', 'V2', 'V3'],
    'Teplice': ['T1', 'T2'],
    'EDL MB': ['EM1', 'EM2', 'EM3'],
    'EDL KV': ['EK1', 'EK2'],
  };

  const subareas = ['Inhouse', 'Inbound', 'Outbound'];

  // ==========================================
  // DERIVED
  // ==========================================
  let systemStep = $derived(schema.steps.find(s => s.id === 'system'));
  let systemOptions = $derived(systemStep ? systemStep.options : []);
  let availableWarehouses = $derived(selectedLocation ? (warehouseMap[selectedLocation] || []) : []);
  let currentStep = $derived(currentStepIndex >= 0 && currentStepIndex < schema.steps.length ? schema.steps[currentStepIndex] : null);
  let canProceedLocation = $derived(selectedWarehouse !== null);

  let breadcrumb = $derived.by(() => {
    const parts = [];
    if (selectedArea) parts.push(selectedArea);
    if (selectedSubarea) parts.push(selectedSubarea);
    if (selectedLocation) parts.push(selectedLocation);
    if (selectedWarehouse) parts.push(selectedWarehouse);
    if (selectedSystem) parts.push(selectedSystem);
    if (currentStep) parts.push(currentStep.question.substring(0, 30) + (currentStep.question.length > 30 ? '...' : ''));
    return parts;
  });

  let canGoNext = $derived.by(() => {
    if (!currentStep) return false;
    if (currentStep.type === 'info') return true;
    return answers[currentStep.id] !== undefined;
  });

  // ==========================================
  // LOGO MAPPING
  // ==========================================
  function getLogoPath(systemName) {
    const key = systemName.toLowerCase().replace(/\s+/g, '_');
    return `/logos/${key}.svg`;
  }

  // ==========================================
  // SCHEMA LOGIC
  // ==========================================
  function evaluateCondition(conditionStr, currentAnswers) {
    if (!conditionStr) return true;
    try {
      const keys = Object.keys(currentAnswers);
      const values = Object.values(currentAnswers);
      const evaluator = new Function(...keys, `return ${conditionStr};`);
      return evaluator(...values);
    } catch (e) {
      return false;
    }
  }

  function findSystemStepIndex() {
    return schema.steps.findIndex(s => s.id === 'system');
  }

  function advanceToNextValidStep(startIndex) {
    let nextIndex = startIndex + 1;

    while (nextIndex < schema.steps.length) {
      const stepToCheck = schema.steps[nextIndex];

      // Skip the system step itself (handled by UI)
      if (stepToCheck.id === 'system') {
        nextIndex++;
        continue;
      }

      if (stepToCheck.type === 'hidden') {
        answers[stepToCheck.id] = 'system_user_123';
        nextIndex++;
        continue;
      }

      if (evaluateCondition(stepToCheck.render_if, answers)) {
        currentStepIndex = nextIndex;
        return;
      }
      nextIndex++;
    }
    finishForm(null);
  }

  // ==========================================
  // HANDLERS - PHASE 1
  // ==========================================
  function selectLocation(loc) {
    selectedLocation = loc;
    selectedWarehouse = null;
  }

  function selectWarehouse(wh) {
    selectedWarehouse = wh;
  }

  function proceedToSystem() {
    if (!canProceedLocation) return;
    answers.area = selectedArea;
    answers.subarea = selectedSubarea;
    answers.location = selectedLocation;
    answers.warehouse = selectedWarehouse;
    answers.additional_info = additionalInfo;
    phase = 'system';
  }

  // ==========================================
  // HANDLERS - PHASE 2
  // ==========================================
  function selectSystem(sys) {
    selectedSystem = sys;
    answers.system = sys;
    // Find first valid step after the system step
    const sysIdx = findSystemStepIndex();
    history = [];
    currentStepIndex = -1;
    advanceToNextValidStep(sysIdx);
  }

  function selectOption(value) {
    if (currentStep) {
      answers[currentStep.id] = value;
    }
  }

  function goNext() {
    if (!currentStep) return;

    const val = answers[currentStep.id];

    if (val === true && currentStep.on_true?.action === 'stop') {
      finishForm(currentStep.on_true.incident_data);
      return;
    }
    if (val === false && currentStep.on_false?.action === 'stop') {
      finishForm(currentStep.on_false.incident_data);
      return;
    }
    if (currentStep.action === 'stop') {
      finishForm(null);
      return;
    }

    history = [...history, currentStepIndex];
    advanceToNextValidStep(currentStepIndex);
  }

  function goBack() {
    if (history.length > 0) {
      const newHistory = [...history];
      const prevIndex = newHistory.pop();
      history = newHistory;
      currentStepIndex = prevIndex;
    } else if (currentStepIndex >= 0) {
      // Go back to system selection
      currentStepIndex = -1;
      selectedSystem = null;
      // Clean system-specific answers, keep location data
      const preserved = { area: answers.area, subarea: answers.subarea, location: answers.location, warehouse: answers.warehouse, additional_info: answers.additional_info };
      answers = preserved;
    } else {
      // Go back to location phase
      phase = 'location';
    }
  }

  function goBackToLocation() {
    phase = 'location';
    selectedSystem = null;
    currentStepIndex = -1;
    history = [];
    const preserved = { area: answers.area, subarea: answers.subarea, location: answers.location, warehouse: answers.warehouse, additional_info: answers.additional_info };
    answers = preserved;
  }

  function finishForm(incidentData) {
    phase = 'finished';
    isFinished = true;
    finalResult = incidentData;
    if (incidentData) {
      console.log('SENDING TO PHP BACKEND:', { answers, incidentData });
    }
  }

  function restart() {
    window.location.reload();
  }
</script>

<!-- HEADER -->
<header class="app-header">
  <div class="header-content">
    <span class="header-title">SKODA SCM Incident Report</span>
  </div>
</header>

<main class="app-main">

  <!-- ============================== -->
  <!-- PHASE 1: LOCATION SELECTION    -->
  <!-- ============================== -->
  {#if phase === 'location'}
    <div class="dashboard-layout">
      <!-- LEFT PANEL -->
      <div class="left-panel">
        <!-- Area Tabs -->
        <div class="area-tabs">
          <button
            class="area-tab {selectedArea === 'Logistika' ? 'active' : ''}"
            onclick={() => { selectedArea = 'Logistika'; }}
          >
            Logistika
          </button>
          <button
            class="area-tab disabled"
            disabled
          >
            Výroba
            <span class="coming-soon">Připravujeme</span>
          </button>
        </div>

        <!-- Subarea Pills -->
        <div class="subarea-pills">
          {#each subareas as sub (sub)}
            <button
              class="subarea-pill {selectedSubarea === sub ? 'active' : ''}"
              onclick={() => { selectedSubarea = sub; }}
            >
              {sub}
            </button>
          {/each}
        </div>

        <!-- Location Grid -->
        <div class="location-grid">
          {#each locations.slice(0, 4) as loc (loc)}
            <button
              class="location-panel {selectedLocation === loc ? 'selected' : ''}"
              onclick={() => selectLocation(loc)}
            >
              {loc}
            </button>
          {/each}

          <div class="grid-separator"></div>

          {#each locations.slice(4) as loc (loc)}
            <button
              class="location-panel {selectedLocation === loc ? 'selected' : ''}"
              onclick={() => selectLocation(loc)}
            >
              {loc}
            </button>
          {/each}
        </div>
      </div>

      <!-- RIGHT PANEL -->
      {#if selectedLocation}
        <div class="right-panel">
          <h2 class="panel-heading">Dostupné sklady <span class="location-badge">{selectedLocation}</span></h2>

          <div class="warehouse-grid">
            {#each availableWarehouses as wh (wh)}
              <button
                class="warehouse-btn {selectedWarehouse === wh ? 'selected' : ''}"
                onclick={() => selectWarehouse(wh)}
              >
                {wh}
              </button>
            {/each}
          </div>

          <div class="additional-input">
            <label for="office-input">Kancelář / Pracoviště (volitelné)</label>
            <input
              id="office-input"
              type="text"
              placeholder="např. B42, Hala 3..."
              bind:value={additionalInfo}
            />
          </div>

          <div class="proceed-area">
            <button
              class="btn-proceed"
              disabled={!canProceedLocation}
              onclick={proceedToSystem}
            >
              Pokračovat
            </button>
          </div>
        </div>
      {/if}
    </div>

  <!-- ============================== -->
  <!-- PHASE 2: SYSTEM & QUESTIONS    -->
  <!-- ============================== -->
  {:else if phase === 'system'}
    <!-- Breadcrumb -->
    <div class="breadcrumb">
      {#each breadcrumb as part, i (i)}
        {#if i > 0}<span class="breadcrumb-sep">&rsaquo;</span>{/if}
        <span class="breadcrumb-item">{part}</span>
      {/each}
    </div>

    <div class="system-layout">
      <!-- LEFT: System Selection -->
      <div class="system-panel">
        <h2 class="panel-heading">Jaký systém má výpadek?</h2>
        <div class="system-grid">
          {#each systemOptions as sys (sys)}
            <button
              class="system-card {selectedSystem === sys ? 'selected' : ''}"
              onclick={() => selectSystem(sys)}
            >
              <div class="system-logo">
                <img src={getLogoPath(sys)} alt="{sys} logo" />
              </div>
              <span class="system-name">{sys}</span>
            </button>
          {/each}
        </div>

        <button class="btn-back-location" onclick={goBackToLocation}>
          Zpět na výběr lokality
        </button>
      </div>

      <!-- RIGHT: Questions -->
      {#if selectedSystem && currentStep}
        <div class="questions-panel">
          <h2 class="question-text">{currentStep.question}</h2>

          {#if currentStep.description}
            <p class="question-description">{currentStep.description}</p>
          {/if}

          <div class="options-area">
            {#if currentStep.type === 'select'}
              {#each currentStep.options as option (option)}
                <button
                  class="option-btn {answers[currentStep.id] === option ? 'selected' : ''}"
                  onclick={() => selectOption(option)}
                >
                  {option}
                </button>
              {/each}

            {:else if currentStep.type === 'boolean'}
              <div class="boolean-buttons">
                <button
                  class="option-btn bool-btn {answers[currentStep.id] === true ? 'selected' : ''}"
                  onclick={() => selectOption(true)}
                >
                  Ano
                </button>
                <button
                  class="option-btn bool-btn {answers[currentStep.id] === false ? 'selected' : ''}"
                  onclick={() => selectOption(false)}
                >
                  Ne
                </button>
              </div>

            {:else if currentStep.type === 'info'}
              <div class="info-box">
                <p>Potvrďte přečtení a pokračujte.</p>
              </div>
            {/if}
          </div>

          <div class="question-nav">
            <button class="btn-nav btn-back" onclick={goBack}>
              Zpět
            </button>
            <button
              class="btn-nav btn-next"
              disabled={!canGoNext}
              onclick={goNext}
            >
              Další
            </button>
          </div>
        </div>
      {/if}
    </div>

  <!-- ============================== -->
  <!-- PHASE 3: RESULT                -->
  <!-- ============================== -->
  {:else if phase === 'finished'}
    <div class="result-overlay">
      <div class="result-card">
        <h2>Proces dokončen</h2>

        {#if finalResult}
          <div class="result-row">
            <span class="result-label">Resolver skupina:</span>
            <span class="result-value">{finalResult.resolver_group}</span>
          </div>
          <div class="result-row">
            <span class="result-label">Zjištěná závada:</span>
            <span class="result-value">{finalResult.actual_defect}</span>
          </div>
          {#if finalResult.backup_strategy}
            <div class="result-backup">
              <strong>Záložní strategie:</strong> {finalResult.backup_strategy}
            </div>
          {/if}
        {:else}
          <p class="result-empty">Proces byl ukončen bez vytvoření ticketu.</p>
        {/if}

        <button class="btn-restart" onclick={restart}>
          Začít znovu
        </button>
      </div>
    </div>
  {/if}

</main>

<style>
  /* ==========================================
     HEADER
     ========================================== */
  .app-header {
    background: #1a202c;
    color: #fff;
    height: 48px;
    display: flex;
    align-items: center;
    padding: 0 24px;
    flex-shrink: 0;
  }
  .header-content {
    display: flex;
    align-items: center;
  }
  .header-title {
    font-weight: 700;
    font-size: 0.95rem;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }

  /* ==========================================
     MAIN LAYOUT
     ========================================== */
  .app-main {
    height: calc(100vh - 48px);
    overflow-y: auto;
    padding: 24px;
  }

  /* ==========================================
     PHASE 1 - DASHBOARD LAYOUT
     ========================================== */
  .dashboard-layout {
    display: flex;
    gap: 24px;
    height: 100%;
    min-height: 0;
  }
  .left-panel {
    width: 33%;
    min-width: 320px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .right-panel {
    flex: 1;
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.06);
    padding: 28px;
    display: flex;
    flex-direction: column;
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateX(8px); }
    to { opacity: 1; transform: translateX(0); }
  }

  /* Area Tabs */
  .area-tabs {
    display: flex;
    gap: 8px;
  }
  .area-tab {
    flex: 1;
    padding: 12px 16px;
    background: #fff;
    border: 2px solid #e2e8f0;
    border-radius: 10px;
    font-size: 0.95rem;
    font-weight: 600;
    color: #1a202c;
    cursor: pointer;
    transition: all 0.2s;
    position: relative;
  }
  .area-tab.active {
    border-color: #4ba82e;
    background: #f0faf0;
    color: #2d6a1e;
  }
  .area-tab.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .coming-soon {
    display: block;
    font-size: 0.65rem;
    font-weight: 400;
    color: #718096;
    margin-top: 2px;
  }

  /* Subarea Pills */
  .subarea-pills {
    display: flex;
    gap: 8px;
  }
  .subarea-pill {
    padding: 8px 18px;
    background: #fff;
    border: 2px solid #e2e8f0;
    border-radius: 20px;
    font-size: 0.85rem;
    font-weight: 500;
    color: #4a5568;
    cursor: pointer;
    transition: all 0.2s;
  }
  .subarea-pill.active {
    border-color: #4ba82e;
    background: #f0faf0;
    color: #2d6a1e;
    font-weight: 600;
  }
  .subarea-pill:hover:not(.active) {
    border-color: #a0aec0;
  }

  /* Location Grid */
  .location-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    flex: 1;
  }
  .grid-separator {
    grid-column: 1 / -1;
    height: 1px;
    background: #e2e8f0;
    margin: 4px 0;
  }
  .location-panel {
    height: 80px;
    background: #fff;
    border: 2px solid #e2e8f0;
    border-radius: 12px;
    font-size: 1.1rem;
    font-weight: 600;
    color: #1a202c;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .location-panel:hover {
    border-color: #4ba82e;
    box-shadow: 0 2px 8px rgba(75, 168, 46, 0.12);
  }
  .location-panel.selected {
    border-color: #4ba82e;
    background: #f0faf0;
    font-weight: 700;
    box-shadow: 0 0 0 1px #4ba82e inset;
  }

  /* Right Panel - Warehouses */
  .panel-heading {
    font-size: 1.2rem;
    font-weight: 600;
    color: #1a202c;
    margin: 0 0 20px 0;
  }
  .location-badge {
    display: inline-block;
    background: #4ba82e;
    color: #fff;
    padding: 2px 10px;
    border-radius: 6px;
    font-size: 0.85rem;
    margin-left: 8px;
    vertical-align: middle;
  }

  .warehouse-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    margin-bottom: 24px;
  }
  .warehouse-btn {
    padding: 14px 8px;
    background: #fff;
    border: 2px solid #e2e8f0;
    border-radius: 10px;
    font-size: 0.95rem;
    font-weight: 600;
    color: #1a202c;
    cursor: pointer;
    transition: all 0.2s;
  }
  .warehouse-btn:hover {
    border-color: #4ba82e;
    box-shadow: 0 2px 6px rgba(75, 168, 46, 0.1);
  }
  .warehouse-btn.selected {
    border-color: #4ba82e;
    background: #f0faf0;
    color: #2d6a1e;
    font-weight: 700;
    box-shadow: 0 0 0 1px #4ba82e inset;
  }

  /* Additional Input */
  .additional-input {
    margin-bottom: 24px;
  }
  .additional-input label {
    display: block;
    font-size: 0.85rem;
    font-weight: 500;
    color: #718096;
    margin-bottom: 6px;
  }
  .additional-input input {
    width: 100%;
    padding: 10px 14px;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    font-size: 0.95rem;
    color: #1a202c;
    outline: none;
    transition: border-color 0.2s;
    font-family: inherit;
  }
  .additional-input input:focus {
    border-color: #4ba82e;
  }
  .additional-input input::placeholder {
    color: #a0aec0;
  }

  /* Proceed Button */
  .proceed-area {
    margin-top: auto;
  }
  .btn-proceed {
    width: 100%;
    padding: 14px;
    background: #4ba82e;
    color: #fff;
    border: none;
    border-radius: 10px;
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
  }
  .btn-proceed:hover:not(:disabled) {
    background: #3d8c25;
  }
  .btn-proceed:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* ==========================================
     PHASE 2 - SYSTEM LAYOUT
     ========================================== */
  .breadcrumb {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 16px;
    font-size: 0.8rem;
    color: #718096;
    flex-wrap: wrap;
  }
  .breadcrumb-sep {
    color: #a0aec0;
    font-size: 1rem;
  }
  .breadcrumb-item {
    white-space: nowrap;
  }

  .system-layout {
    display: flex;
    gap: 24px;
    height: calc(100% - 36px);
    min-height: 0;
  }

  .system-panel {
    width: 33%;
    min-width: 320px;
    display: flex;
    flex-direction: column;
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.06);
    padding: 24px;
  }

  .system-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    flex: 1;
    align-content: start;
    margin-top: 16px;
  }
  .system-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 16px 8px;
    background: #fff;
    border: 2px solid #e2e8f0;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
    gap: 8px;
  }
  .system-card:hover {
    border-color: #4ba82e;
    box-shadow: 0 2px 8px rgba(75, 168, 46, 0.12);
  }
  .system-card.selected {
    border-color: #4ba82e;
    background: #f0faf0;
    box-shadow: 0 0 0 1px #4ba82e inset;
  }
  .system-logo {
    width: 56px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .system-logo img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
  .system-name {
    font-size: 0.85rem;
    font-weight: 600;
    color: #1a202c;
    text-align: center;
  }

  .btn-back-location {
    margin-top: 16px;
    padding: 10px;
    background: #f0f2f5;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    font-size: 0.85rem;
    color: #718096;
    cursor: pointer;
    transition: all 0.2s;
  }
  .btn-back-location:hover {
    background: #e2e8f0;
    color: #4a5568;
  }

  /* Questions Panel */
  .questions-panel {
    flex: 1;
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.06);
    padding: 28px;
    display: flex;
    flex-direction: column;
    animation: fadeIn 0.2s ease;
  }

  .question-text {
    font-size: 1.3rem;
    font-weight: 600;
    color: #1a202c;
    margin: 0 0 12px 0;
  }
  .question-description {
    color: #718096;
    font-style: italic;
    margin: 0 0 20px 0;
  }

  .options-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 24px;
  }

  .option-btn {
    display: block;
    width: 100%;
    padding: 14px 20px;
    background: #fff;
    color: #1a202c;
    border: 2px solid #e2e8f0;
    border-radius: 10px;
    font-size: 0.95rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
  }
  .option-btn:hover {
    border-color: #4ba82e;
    background: #fafff8;
  }
  .option-btn.selected {
    border-color: #4ba82e;
    background: #f0faf0;
    color: #2d6a1e;
    font-weight: 700;
    box-shadow: 0 0 0 1px #4ba82e inset;
  }

  .boolean-buttons {
    display: flex;
    gap: 12px;
  }
  .bool-btn {
    flex: 1;
    text-align: center;
  }

  .info-box {
    padding: 16px 20px;
    background: #f0faf0;
    border-left: 4px solid #4ba82e;
    border-radius: 0 8px 8px 0;
    color: #2d6a1e;
    font-size: 0.95rem;
  }
  .info-box p {
    margin: 0;
  }

  /* Question Navigation */
  .question-nav {
    display: flex;
    justify-content: space-between;
    border-top: 1px solid #e2e8f0;
    padding-top: 20px;
    margin-top: auto;
  }
  .btn-nav {
    padding: 12px 28px;
    font-size: 0.95rem;
    border-radius: 8px;
    cursor: pointer;
    border: none;
    font-weight: 600;
    transition: all 0.2s;
  }
  .btn-nav:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .btn-back {
    background: #f0f2f5;
    color: #4a5568;
  }
  .btn-back:hover:not(:disabled) {
    background: #e2e8f0;
  }
  .btn-next {
    background: #4ba82e;
    color: #fff;
  }
  .btn-next:hover:not(:disabled) {
    background: #3d8c25;
  }

  /* ==========================================
     PHASE 3 - RESULT
     ========================================== */
  .result-overlay {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
  }
  .result-card {
    background: #fff;
    border-radius: 16px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.08);
    padding: 40px 48px;
    max-width: 520px;
    width: 100%;
    text-align: center;
  }
  .result-card h2 {
    font-size: 1.4rem;
    color: #1a202c;
    margin: 0 0 24px 0;
  }
  .result-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 10px 0;
    border-bottom: 1px solid #f0f2f5;
    text-align: left;
  }
  .result-label {
    font-size: 0.85rem;
    color: #718096;
    font-weight: 500;
    flex-shrink: 0;
    margin-right: 12px;
  }
  .result-value {
    font-weight: 700;
    color: #1a202c;
    text-align: right;
  }
  .result-backup {
    margin-top: 20px;
    padding: 14px 18px;
    background: #fff8e6;
    border: 1px solid #f0d88c;
    border-radius: 8px;
    color: #7a6220;
    font-size: 0.9rem;
    text-align: left;
  }
  .result-empty {
    color: #718096;
    font-size: 0.95rem;
  }
  .btn-restart {
    margin-top: 28px;
    padding: 12px 32px;
    background: #4ba82e;
    color: #fff;
    border: none;
    border-radius: 10px;
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
  }
  .btn-restart:hover {
    background: #3d8c25;
  }
</style>
