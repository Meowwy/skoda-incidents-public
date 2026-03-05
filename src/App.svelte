<script>
  import { onMount } from "svelte";
  import schemaData from "./assets/compiled-schema.json";

  let schema = schemaData;
  let answers = {};
  let currentStepIndex = 0;
  let isFinished = false;
  let finalResult = null;

  // 🆕 Tracks the path the user took so the Back button knows exactly where to return
  let history = [];

  $: currentStep = schema.steps[currentStepIndex];

  onMount(() => {
    advanceToNextValidStep(-1);
  });

  // ==========================================
  // 🧠 THE LOGIC EVALUATOR
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

  // ==========================================
  // 🧭 THE NAVIGATION ENGINE
  // ==========================================
  function advanceToNextValidStep(startIndex) {
    let nextIndex = startIndex + 1;

    while (nextIndex < schema.steps.length) {
      const stepToCheck = schema.steps[nextIndex];

      if (stepToCheck.type === "hidden") {
        answers[stepToCheck.id] = "system_user_123";
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
  // 🖱️ THE INTERACTION HANDLERS
  // ==========================================

  // 🆕 1. Just saves the selection visually, but doesn't move forward
  function selectOption(value) {
    answers[currentStep.id] = value;
  }

  // 🆕 2. Validates and moves forward
  function goNext() {
    const val = answers[currentStep.id];

    if (val === true && currentStep.on_true?.action === "stop") {
      finishForm(currentStep.on_true.incident_data);
      return;
    }
    if (val === false && currentStep.on_false?.action === "stop") {
      finishForm(currentStep.on_false.incident_data);
      return;
    }
    if (currentStep.action === "stop") {
      finishForm(null);
      return;
    }

    // Save current step to history, then calculate the next step
    history = [...history, currentStepIndex];
    advanceToNextValidStep(currentStepIndex);
  }

  // 🆕 3. Moves backward based on the exact path the user took
  function goBack() {
    if (history.length > 0) {
      const prevIndex = history.pop();
      history = history; // Triggers Svelte UI update
      currentStepIndex = prevIndex;
    }
  }

  function finishForm(incidentData) {
    isFinished = true;
    finalResult = incidentData;
    if (incidentData) {
      console.log("SENDING TO PHP BACKEND:", { answers, incidentData });
    }
  }
</script>

<main class="wizard-container">
  {#if !isFinished}
    <div class="progress">Krok {history.length + 1}</div>

    <h2>{currentStep.question}</h2>

    {#if currentStep.description}
      <p class="description">{currentStep.description}</p>
    {/if}

    <div class="input-area">
      {#if currentStep.type === "select"}
        {#each currentStep.options as option}
          <button
            class="option-btn {answers[currentStep.id] === option
              ? 'selected'
              : ''}"
            on:click={() => selectOption(option)}
          >
            {option}
          </button>
        {/each}
      {:else if currentStep.type === "boolean"}
        <button
          class="option-btn yes {answers[currentStep.id] === true
            ? 'selected'
            : ''}"
          on:click={() => selectOption(true)}>Ano</button
        >
        <button
          class="option-btn no {answers[currentStep.id] === false
            ? 'selected'
            : ''}"
          on:click={() => selectOption(false)}>Ne</button
        >
      {:else if currentStep.type === "info"}
        <div class="info-box">Potvrďte přečtení a pokračujte.</div>
      {/if}
    </div>

    <div class="footer-nav">
      <button
        class="nav-btn btn-back"
        on:click={goBack}
        disabled={history.length === 0}
      >
        Zpět
      </button>

      <button
        class="nav-btn btn-next"
        on:click={goNext}
        disabled={currentStep.type !== "info" &&
          answers[currentStep.id] === undefined}
      >
        Další
      </button>
    </div>
  {:else}
    <div class="success-screen">
      <h2>Proces dokončen</h2>
      {#if finalResult}
        <p>
          Vytvářím ticket pro skupinu: <strong
            >{finalResult.resolver_group}</strong
          >
        </p>
        <p>Zjištěná závada: <strong>{finalResult.actual_defect}</strong></p>
        {#if finalResult.backup_strategy}
          <div class="backup-strategy">
            <strong>Záložní strategie:</strong>
            {finalResult.backup_strategy}
          </div>
        {/if}
      {:else}
        <p>Proces byl ukončen bez vytvoření ticketu.</p>
      {/if}
      <button
        class="nav-btn btn-next"
        style="margin-top: 20px;"
        on:click={() => window.location.reload()}>Začít znovu</button
      >
    </div>
  {/if}
</main>

<style>
  .wizard-container {
    max-width: 600px;
    margin: 50px auto;
    font-family: sans-serif;
    padding: 30px;
    background: #fdfdfd;
    color: #333;
    border-radius: 8px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  }
  .progress {
    font-size: 0.8rem;
    color: #888;
    margin-bottom: 10px;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  h2 {
    color: #222;
    margin-bottom: 20px;
    font-size: 1.5rem;
  }
  .description {
    color: #666;
    margin-bottom: 20px;
    font-style: italic;
  }

  .input-area {
    margin-bottom: 30px;
  }

  .option-btn {
    display: block;
    width: 100%;
    padding: 15px 20px;
    margin-bottom: 10px;
    background: #fff;
    color: #444;
    border: 2px solid #e0e0e0;
    border-radius: 8px;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
  }

  .option-btn:hover {
    border-color: #b3d4ff;
    background: #f4f8ff;
  }

  /* 🆕 Selected State Styling */
  .option-btn.selected {
    border-color: #0066cc;
    background: #eef5ff;
    color: #004b99;
    font-weight: bold;
    box-shadow: 0 0 0 1px #0066cc inset;
  }

  .option-btn.yes {
    text-align: center;
  }
  .option-btn.no {
    text-align: center;
  }

  .info-box {
    padding: 15px;
    background: #f0f4f8;
    border-left: 4px solid #0066cc;
    color: #555;
  }

  /* 🆕 Footer Navigation Styling */
  .footer-nav {
    display: flex;
    justify-content: space-between;
    border-top: 1px solid #eee;
    padding-top: 20px;
  }

  .nav-btn {
    padding: 12px 24px;
    font-size: 1rem;
    border-radius: 6px;
    cursor: pointer;
    border: none;
    font-weight: bold;
    transition: background 0.2s;
  }

  .nav-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-back {
    background: #f0f0f0;
    color: #555;
  }
  .btn-back:hover:not(:disabled) {
    background: #e0e0e0;
  }

  .btn-next {
    background: #0066cc;
    color: white;
  }
  .btn-next:hover:not(:disabled) {
    background: #004b99;
  }

  .success-screen {
    text-align: center;
  }
  .backup-strategy {
    margin-top: 20px;
    padding: 15px;
    background: #fff3cd;
    border: 1px solid #ffeeba;
    border-radius: 4px;
    color: #856404;
  }
</style>
