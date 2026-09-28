<div id="assistant-bouton" aria-label="Ouvrir l'assistant">💬</div>
<div id="assistant-panneau" hidden>
  <div class="assistant-entete">
    <span>🤖 Assistant du site</span>
    <button type="button" id="assistant-fermer" aria-label="Fermer">✕</button>
  </div>
  <div id="assistant-messages"></div>
  <form id="assistant-form">
    <input type="text" id="assistant-saisie" placeholder="Pose une question..." autocomplete="off" maxlength="500">
    <button type="submit">➤</button>
  </form>
</div>
<script src="assistant.js" defer></script>
