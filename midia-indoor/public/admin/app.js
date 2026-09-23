function novasCampanhas() {
  alert('Nova campanha');
}

function novasTelas() {
  alert('Nova tela');
}

document.querySelectorAll('nav a').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const page = link.getAttribute('href').substring(1);
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    document.getElementById(page).style.display = 'block';
  });
});

// Load data
async function carregarTelas() {
  const res = await fetch('/api/telas');
  const telas = await res.json();
  console.log('Telas:', telas);
}

carregarTelas();
