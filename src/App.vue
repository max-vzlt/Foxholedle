<script setup>
</script>

<template>
  <div id="app">
    <header>
      <nav>
        <router-link to="/">Classic</router-link>
        <router-link to="/recon">Recon</router-link>
        <router-link to="/armory">Armory</router-link>
        <router-link to="/exadle">Exadle</router-link>
        <router-link to="/timeline">Timeline</router-link>
        <router-link to="/cityguessr">Cityguessr</router-link>
      </nav>
    </header>
    <router-view />
    <footer>
      <div id="footer-content">
        <h1>Foxholedle</h1>
        <hr>
        <p>Fanmade training tool  </p>
        <p>Based on Foxhole (<a href="https://www.siegecamp.com/">© Siege Camp</a>). All rights belong to their respective owners.</p>
        <p>Feedback / reports: <img src="@/assets/discord-icon.svg" alt="Discord"> lastro_</p>
      </div>
    </footer>
  </div>
</template>

<style>
header{
  display: flex;
  justify-content: center;
  width: 100%;
  background: var(--dark-color);
  padding: 10px 0;
}
nav {
  display: flex;
  width: var(--page-content-width);
  gap: 16px;
}

nav a {
  color: var(--light-color);
  text-decoration: none;
}

nav a.router-link-active {
  font-weight: bold;
  text-decoration: underline;
}

footer{
  display: flex;
  margin-top: auto;
  justify-content: center;
  width: 100%;
  background: var(--darker-color);
  color: var(--light-color);
  padding: 50px 0;
}

footer div#footer-content{
  display: flex;
  flex-direction: column;
  width: var(--page-content-width);
  gap: 16px;
}

footer hr{
  margin: 1px solid var(--light-color);
}

footer p{
  display: flex;
  gap: 5px;
  align-items: center;
  margin: 0;
}

footer a:link,footer a:visited{
  color: var(--light-color);
}

footer a:hover{
  color: var(--medium-color);
}

footer img{
  height: 20px;
}
</style>