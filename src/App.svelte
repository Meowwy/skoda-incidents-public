<script>
  import schemaData from "./assets/compiled-schema.json";
  import warehousesData from "./assets/compiled-warehouses.json";

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
  let selectedScenarioIndex = $state(0);

  // ==========================================
  // STATIC DATA (from compiled-warehouses.json)
  // ==========================================
  const locations = warehousesData.locations.map(l => l.name);
  const warehouseMap = Object.fromEntries(warehousesData.locations.map(l => [l.name, l.warehouses]));

  const subareas = ['Inhouse', 'Inbound', 'Outbound'];

  // ==========================================
  // DERIVED
  // ==========================================
  let systemStep = $derived(schema.steps.find(s => s.id === 'system'));
  let systemOptions = $derived(systemStep ? systemStep.options : []);
  let availableWarehouses = $derived(selectedLocation ? (warehouseMap[selectedLocation] || []) : []);
  let currentStep = $derived(currentStepIndex >= 0 && currentStepIndex < schema.steps.length ? schema.steps[currentStepIndex] : null);
  let canProceedLocation = $derived(selectedWarehouse !== null);

  // Reset scenario selection when navigating to a new diagnostic step
  $effect(() => {
    if (currentStep?.type === 'diagnostic') {
      selectedScenarioIndex = 0;
    }
  });

  // Trail of previously answered select steps (for drill-down UI)
  let selectTrail = $derived.by(() => {
    const trail = [];
    for (const idx of history) {
      const step = schema.steps[idx];
      if (step.type === 'select') {
        trail.push({ step, answer: answers[step.id] });
      }
    }
    return trail;
  });

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
        if (evaluateCondition(stepToCheck.render_if, answers)) {
          answers[stepToCheck.id] = stepToCheck.value ?? 'system_user_123';
        }
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

  function selectAndAdvance(value) {
    if (!currentStep) return;
    answers[currentStep.id] = value;
    goNext();
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

      <!-- RIGHT: Diagram or Questions -->
      {#if !selectedSystem}
        <div class="diagram-panel">
          <img src="/diagram/systems_diagram.png" alt="Schéma propojení systémů" class="diagram-img" />
        </div>
      {:else if currentStep && currentStep.type === 'select'}
        <!-- DRILL-DOWN MODE: horizontal columns for select steps -->
        <div class="drilldown-panel">
          <div class="drilldown-columns">
            {#each selectTrail as item (item.step.id)}
              <div class="drilldown-answered">
                <span class="drilldown-label">{item.step.question}</span>
                <span class="drilldown-value">{item.answer}</span>
              </div>
              <span class="drilldown-sep">&rsaquo;</span>
            {/each}

            <div class="drilldown-current">
              <span class="drilldown-label">{currentStep.question}</span>
              <div class="drilldown-options">
                {#each currentStep.options as option, i (i)}
                  {#if typeof option === 'string'}
                    <button
                      class="drilldown-option-btn"
                      onclick={() => selectAndAdvance(option)}
                    >
                      {option}
                    </button>
                  {:else if option.group}
                    <span class="option-group-label">{option.group}</span>
                    {#each option.options as subOption (subOption)}
                      <button
                        class="drilldown-option-btn"
                        onclick={() => selectAndAdvance(subOption)}
                      >
                        {subOption}
                      </button>
                    {/each}
                  {/if}
                {/each}
              </div>
            </div>
          </div>

          <div class="question-nav">
            <button class="btn-nav btn-back" onclick={goBack}>Zpět</button>
          </div>
        </div>

      {:else if currentStep && currentStep.type === 'diagnostic'}
        <!-- DIAGNOSTIC MODE: numbered vertical tabs + two-part detail panel -->
        <div class="diagnostic-panel">
          {#if selectTrail.length > 0}
            <div class="trail-summary">
              {#each selectTrail as item, i (item.step.id)}
                {#if i > 0}<span class="trail-sep">&rsaquo;</span>{/if}
                <span class="trail-chip">{item.answer}</span>
              {/each}
            </div>
          {/if}

          <h2 class="diagnostic-heading">{currentStep.question}</h2>

          <div class="diagnostic-layout">
            <div class="scenario-tabs">
              <span class="scenario-tabs-label">Doporučené pořadí kontroly</span>
              {#each currentStep.scenarios as scenario, i (i)}
                <button
                  class="scenario-tab {selectedScenarioIndex === i ? 'active' : ''}"
                  onclick={() => selectedScenarioIndex = i}
                >
                  <span class="scenario-tab-number">{i + 1}.</span>
                  {scenario.title}
                </button>
              {/each}
            </div>

            {#if currentStep.scenarios[selectedScenarioIndex]}
              {@const scenario = currentStep.scenarios[selectedScenarioIndex]}
              <div class="scenario-detail">
                <h3 class="scenario-title">
                  <span class="scenario-title-number">{selectedScenarioIndex + 1}.</span>
                  {scenario.title}
                </h3>

                <!-- UPPER: Diagnostic question -->
                <div class="scenario-question-box">
                  <p class="scenario-description">{scenario.description}</p>
                </div>

                <!-- LOWER: Two-column answer layout -->
                <div class="answer-columns">
                  <!-- OK side (all clear) -->
                  <div class="answer-ok">
                    <span class="answer-label-ok">{scenario.ok_answer}</span>
                    <span class="answer-hint-ok">Pokračujte na další kontrolu</span>
                  </div>

                  <!-- Separator -->
                  <div class="answer-separator">
                    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                      <line x1="6" y1="6" x2="22" y2="22" stroke="#cbd5e0" stroke-width="2.5" stroke-linecap="round"/>
                      <line x1="22" y1="6" x2="6" y2="22" stroke="#cbd5e0" stroke-width="2.5" stroke-linecap="round"/>
                    </svg>
                  </div>

                  <!-- NOK side (incident) -->
                  <div class="answer-nok">
                    <span class="answer-label-nok">{scenario.nok_answer}</span>

                    {#if scenario.action}
                      <div class="nok-action">
                        <span class="nok-action-label">Doporučená akce</span>
                        {scenario.action}
                      </div>
                    {/if}

                    {#if scenario.resolutions && scenario.resolutions.length > 0}
                      {#each scenario.resolutions as resolution, ri (ri)}
                        <div class="resolution-card">
                          <div class="resolution-details">
                            {#if resolution.actual_defect}
                              <div class="resolution-row">
                                <span class="resolution-label">Zjištěná závada:</span>
                                <span class="resolution-value">{resolution.actual_defect}</span>
                              </div>
                            {/if}
                            {#if resolution.resolver_group}
                              <div class="resolution-row">
                                <span class="resolution-label">Resolver skupina:</span>
                                <span class="resolution-value">{resolution.resolver_group}</span>
                              </div>
                            {/if}
                            {#if resolution.impact}
                              <div class="resolution-row">
                                <span class="resolution-label">Impact:</span>
                                <span class="resolution-value">{resolution.impact}</span>
                              </div>
                            {/if}
                            {#if resolution.backup_strategy}
                              <div class="resolution-backup">
                                <strong>Záložní strategie:</strong> {resolution.backup_strategy}
                              </div>
                            {/if}
                          </div>
                        </div>
                      {/each}

                      <div class="scenario-actions">
                        <button class="btn-submit" disabled title="Připravujeme">
                          Odeslat incident
                          <span class="btn-badge">Připravujeme</span>
                        </button>
                      </div>
                    {:else}
                      <div class="resolution-selfclose">
                        Eskalace není potřeba — incident lze uzavřít po provedení akce.
                      </div>
                    {/if}
                  </div>
                </div>
              </div>
            {/if}
          </div>

          <div class="question-nav">
            <button class="btn-nav btn-back" onclick={goBack}>Zpět</button>
          </div>
        </div>

      {:else if currentStep}
        <!-- FALLBACK: normal panel for boolean/info steps -->
        <div class="questions-panel">
          {#if selectTrail.length > 0}
            <div class="trail-summary">
              {#each selectTrail as item, i (item.step.id)}
                {#if i > 0}<span class="trail-sep">&rsaquo;</span>{/if}
                <span class="trail-chip">{item.answer}</span>
              {/each}
            </div>
          {/if}

          <h2 class="question-text">{currentStep.question}</h2>

          {#if currentStep.description}
            <p class="question-description">{currentStep.description}</p>
          {/if}

          <div class="options-area">
            {#if currentStep.type === 'boolean'}
              <div class="boolean-buttons">
                <button
                  class="option-btn bool-btn {answers[currentStep.id] === true ? 'selected' : ''}"
                  onclick={() => selectAndAdvance(true)}
                >
                  Ano
                </button>
                <button
                  class="option-btn bool-btn {answers[currentStep.id] === false ? 'selected' : ''}"
                  onclick={() => selectAndAdvance(false)}
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
            {#if currentStep.type === 'info'}
              <button class="btn-nav btn-next" onclick={goNext}>
                Pokračovat
              </button>
            {/if}
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
            <span class="result-label">Zjištěná závada:</span>
            <span class="result-value">{finalResult.actual_defect}</span>
          </div>
          {#if finalResult.resolver_group}
            <div class="result-row">
              <span class="result-label">Resolver skupina:</span>
              <span class="result-value">{finalResult.resolver_group}</span>
            </div>
          {/if}
          {#if finalResult.impact}
            <div class="result-row">
              <span class="result-label">Impact:</span>
              <span class="result-value">{finalResult.impact}</span>
            </div>
          {/if}
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
