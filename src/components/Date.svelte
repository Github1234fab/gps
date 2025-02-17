<script>
const optionsDate = { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric'
};

const optionsTime = { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit' 
};

const now = new Date();
const dateFr = now.toLocaleDateString('fr-FR', optionsDate);
const timeFr = now.toLocaleTimeString('fr-FR', optionsTime);
</script>

<div class="wrapper__date-time">
<h3>{dateFr}</h3>
<h3>{timeFr}</h3>
</div>

<style>
	h3 {
		text-align: left;
		font-size: 1rem;
	}
</style>
