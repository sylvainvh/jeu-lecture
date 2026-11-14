# Le jeu de l'oie des mots

Jeu de l'oie en 3D pour s'entraîner à la lecture globale. Chaque case porte un mot ;
quand un pion s'y arrête, la carte du mot s'affiche en grand (écriture script et cursive,
syllabes colorées, lettres muettes soulignées), se retourne pour montrer l'image et peut être lue à voix haute.

- 1 à 4 joueurs sur le même écran, dé à l'écran ou vrai dé (on tape le chiffre obtenu)
- échelles et serpents tirés au hasard à chaque partie
- lecture à voix haute du mot entier (🔊) et **syllabe par syllabe** (🐢, « la … mai … son »), quand le découpage de la prononciation est sûr
- **profils d'enfants** : chaque enfant a un prénom et un avancement mot par mot. Après chaque mot,
  le parent clique 👍 ou 👎 ; au bout de 10 réussites (réglable) le mot est acquis et sort environ quatre fois moins souvent
- **administration** (mot de passe) : mots, images (pictogrammes ARASAAC ou image personnelle), sons
  (voix de synthèse ou enregistrement), enfants et mots acquis, couleurs, code de classe

## Comptes et confidentialité

- Pour inscrire un enfant, il faut le **code de classe** (visible et modifiable dans Administration → Réglages).
- Chaque enfant reçoit un **code secret** (ex. `K7QF-9M2X-TB4H`), gardé dans un cookie du navigateur pendant 400 jours.
  Un navigateur ne voit que les enfants dont il détient le code ; personne ne peut lister les enfants de la classe, sauf l'administrateur.
- Changement de navigateur ou d'appareil : page « Les enfants » → « J'ai déjà un code ». Le code se lit sur l'appareil d'origine
  (« Voir le code ») ou dans l'administration.
- Les joueurs « invités » n'ont pas de profil : leurs réussites ne sont pas retenues.
- L'administrateur voit le prénom, les mots et l'avancement de chaque enfant ; le formulaire d'inscription le signale.

## Installation sur Unraid

L'image n'est pas publiée sur un registre : on la construit puis on la copie sur le NAS.

1. Construire l'image (sur un PC avec Docker ou Podman) et l'exporter :

   ```sh
   docker build -t jeu-lecture:latest .
   docker save jeu-lecture:latest | gzip > jeu-lecture.tar.gz
   ```

2. Copier `jeu-lecture.tar.gz` sur le NAS puis, dans le terminal Unraid :

   ```sh
   docker load < /mnt/user/chemin/vers/jeu-lecture.tar.gz
   ```

3. Dans Unraid : onglet **Docker → Add Container**

   | Champ | Valeur |
   |---|---|
   | Name | `jeu-lecture` |
   | Repository | `jeu-lecture:latest` |
   | Network Type | `bridge` |
   | Port | conteneur `8080` → hôte `8080` (ou un autre port libre) |
   | Path | conteneur `/data` → hôte `/mnt/user/appdata/jeu-lecture` |
   | Variable | `ADMIN_PASSWORD` = mot de passe de l'administration |
   | Variable (facultatif) | `CLASS_CODE` = code de classe initial |

   Ou en ligne de commande :

   ```sh
   docker run -d --name jeu-lecture --restart unless-stopped \
     -p 8080:8080 -v /mnt/user/appdata/jeu-lecture:/data \
     -e ADMIN_PASSWORD='un-bon-mot-de-passe' -e CLASS_CODE=CP1A jeu-lecture:latest
   ```

4. Ouvrir `http://adresse-du-nas:8080` dans un navigateur.

Tous les mots, images, sons, enfants et avancements sont dans `/data` : sauvegarder ce dossier suffit.
Pour mettre le jeu à jour, reconstruire l'image, la recharger et recréer le conteneur ; `/data` est conservé.

### À savoir

- **Mot de passe** : sans `ADMIN_PASSWORD`, un mot de passe provisoire est tiré au hasard à chaque démarrage et écrit dans les logs du conteneur. L'administration n'est jamais ouverte.
- **Exposition sur internet** : placer le jeu derrière un reverse proxy **HTTPS**. Les cookies sont alors marqués `Secure`, et les tentatives de mot de passe ou de code sont limitées par adresse IP (le proxy doit transmettre `X-Forwarded-For` et `X-Forwarded-Proto`).
- **Internet** n'est nécessaire que pour chercher un pictogramme ARASAAC lors de l'ajout d'un mot. Le jeu lui-même fonctionne hors ligne.
- **Enregistrer sa voix au micro** n'est autorisé par les navigateurs qu'en HTTPS. En `http://…`, le bouton est masqué ;
  on peut importer un fichier son à la place, ou placer le jeu derrière un reverse proxy HTTPS.
- L'image est prévue pour un NAS à processeur Intel/AMD (x86-64).

## Développement

```sh
npm install
npm run dev      # serveur sur :8080, interface sur http://localhost:5173
npm test         # découpage en syllabes, coloration, mots acquis, génération du plateau
npm run build && npm start
```

Sans Piper sur la machine (cas du développement), la lecture utilise la voix du navigateur.

| Variable | Défaut | Rôle |
|---|---|---|
| `PORT` | `8080` | port d'écoute |
| `DATA_DIR` | `./data` (`/data` dans l'image) | mots, images, sons, réglages |
| `ADMIN_PASSWORD` | aléatoire, écrit dans les logs | mot de passe de l'administration (`ADMIN_PIN` reste accepté) |
| `CLASS_CODE` | aléatoire | code de classe initial (premier démarrage seulement) |
| `PIPER_BIN`, `PIPER_MODEL` | chemins de l'image | synthèse vocale |

## Crédits

- Pictogrammes : Sergio Palao, [ARASAAC](https://arasaac.org), propriété du Gouvernement d'Aragon, licence CC BY-NC-SA (usage non commercial).
- Polices : Andika (SIL), Playwrite FR Trad (TypeTogether), Fredoka — licence OFL.
- Voix : [Piper](https://github.com/rhasspy/piper), voix `fr_FR-siwis-medium`.
