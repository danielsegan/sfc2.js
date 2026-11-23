# CE 2.670 extracted-tree inventory

Observed on the private `sfc2-ci` runner against Community Edition 2.670 (no 2.679 patch).
This document is metadata only: paths, sizes, hashes, counts, header names, and aggregate stats.
It contains no game data rows and no binary payloads.

- Generated (UTC): `2026-11-23T21:34:01Z`
- Extracted tree: `/srv/sfc2/extracted/2.670`
- Reference tree: `/srv/sfc2/reference/2.670`
- Manifest: `/srv/sfc2/extracted/2.670/manifest.json`
- Files: 5555
- Total bytes: 865706682

## Manifest cross-check

- Manifest entries: 5555
- Missing on disk: 0
- Size mismatches: 0
- Extra on disk (not in manifest, excluding manifest.json): 0

## Counts by extension

| Extension | Count | Total bytes |
| --- | ---: | ---: |
| `.bmp` | 2649 | 115136388 |
| `.wav` | 2008 | 579408064 |
| `.mod` | 317 | 30467500 |
| `(none)` | 166 | 18202 |
| `.scr` | 127 | 49945600 |
| `.bft` | 126 | 5508016 |
| `.fnt` | 57 | 1646052 |
| `.gf` | 28 | 59693 |
| `.mct` | 28 | 28336 |
| `.txt` | 15 | 2327092 |
| `.cur` | 11 | 24618 |
| `.mvm` | 9 | 238652 |
| `.i` | 3 | 270 |
| `.ini` | 3 | 4507 |
| `.bat` | 2 | 4387 |
| `.iii` | 2 | 308 |
| `.lst` | 1 | 1542 |
| `.q3` | 1 | 80717666 |
| `.sds` | 1 | 158235 |
| `.siz` | 1 | 11554 |

## Counts by top-level folder

| Folder | Count | Total bytes |
| --- | ---: | ---: |
| `textures` | 2649 | 115136388 |
| `sounds` | 2010 | 579490924 |
| `models` | 318 | 30479054 |
| `tables` | 186 | 2265133 |
| `fonts` | 184 | 7156454 |
| `scripts` | 156 | 49975478 |
| `settings` | 28 | 59693 |
| `other` | 12 | 401274 |
| `cursors` | 11 | 24618 |
| `sprites` | 1 | 80717666 |

## README structure (`/srv/sfc2/README.md`)

- Size: 3424 bytes
- Headings:
  - L1: SFC2 CE 2.670 private data (sfc2-ci)
  - L2: Layout
  - L2: Installer and method
  - L2: Extraction
  - L2: Policy
- Mentioned `/srv/sfc2/` paths:
  - `/srv/sfc2/extracted`
  - `/srv/sfc2/extracted/2.670/`
  - `/srv/sfc2/extracted/2.670/manifest.json`
  - `/srv/sfc2/installers/SFCIICE_2670.exe`
  - `/srv/sfc2/installers/readme.txt`
  - `/srv/sfc2/reference/2.670/`
  - `/srv/sfc2/tools/extract.sh`
  - `/srv/sfc2/wineprefix-2.670`

## Notable locations

### audio

2008 path(s).

By folder (path and count only):

| Folder | Count |
| --- | ---: |
| `sounds/voice` | 957 |
| `sounds/music` | 698 |
| `sounds/sfx` | 353 |

First 10 paths:

| Path | Size | sha256 |
| --- | ---: | --- |
| `sounds/music/ASB.WAV` | 5819656 | `329f3345fe15a89040d78800bc2037b8334ce98e3a8288347e835206d9bb6903` |
| `sounds/music/BML_A1.WAV` | 374840 | `6a892f1f183e6ee67b20a86e5fa5ac51d6ac29f5e438a84881c7971e1d91d10b` |
| `sounds/music/BML_A2.WAV` | 373548 | `e6c50a0e29b971705a2837a33849bf05f39f8ba8138a958e6e17873438d95c05` |
| `sounds/music/BML_A3.WAV` | 369812 | `c6b5fb4fca8293b663a39a838615084d0b1b8636954d10c352dc4fbbb3d1d6ea` |
| `sounds/music/BML_A4.WAV` | 370244 | `efae6ef37ee72ecffd084800bb5fdc39bd8370adc9e2bd147c5094f576d111d8` |
| `sounds/music/BML_A5.WAV` | 371632 | `99e61de8c64503c2d96e3917eb6c41d26b3ffc1a052bd3f8120145fe31228bca` |
| `sounds/music/BML_A6.WAV` | 371848 | `98637acac9d9fcec398680acb815bae5c6cb49c2a681c71f492efb45f32966fd` |
| `sounds/music/BML_A7.WAV` | 372268 | `dd2289d102f79e00004c61e815c191ff5440340854aba3541deb47123b3e6ef0` |
| `sounds/music/BML_B1.WAV` | 371188 | `dbc92df6dfcf6cba5c929bc179d1344cd2aecc8400fdac68d041760965e1d9b1` |
| `sounds/music/BML_B2.WAV` | 183768 | `6e75f61e40696683bc96217f686acc625b9f1567b3707b3e40872da52449fcca` |

### bft

126 path(s).

| Path | Size | sha256 |
| --- | ---: | --- |
| `fonts/Assets/aafonts/arial10.bft` | 22986 | `6808fe130f83c58956b352139898ae8272c8bcd13fbb6130703a7647ddbc3eed` |
| `fonts/Assets/aafonts/arial11.bft` | 30323 | `9a1fa5a090414b932be1c01880d8483be8e3e4287f88d0b5b6d8b897ca942d95` |
| `fonts/Assets/aafonts/arial12.bft` | 34402 | `7441d8128c9386edc529dc1caba3343f379d78e8642a6f50f92eb6c0293636d1` |
| `fonts/Assets/aafonts/arial14.bft` | 43787 | `84f834f06b0aab298f5981eb4952b25aa3cc8e42ab369b1ff83f6cc9a94daefb` |
| `fonts/Assets/aafonts/arial16.bft` | 54986 | `d4302352661866aa7b396a85a80070169a1a90eabe4efab1030b52e71da3965e` |
| `fonts/Assets/aafonts/arial18.bft` | 66523 | `b315096c79797c07f3034a03eb5ee2c9d5d09eb955f163322d58c3bfe82a500e` |
| `fonts/Assets/aafonts/arial20.bft` | 79058 | `bf56e6f3090a1d59b99b155a978758e66f694dcab640aee0ddf56816bb46dafd` |
| `fonts/Assets/aafonts/arial22.bft` | 93575 | `786c09fb57e08780f03ac7142b69a2fdd2f6867fafd01157d1a9888300fdfb94` |
| `fonts/Assets/aafonts/arial24.bft` | 109303 | `33fafe1d38833030e9c6c14f4b2d5fa804517ba901a9b0163e946600f045538d` |
| `fonts/Assets/aafonts/arial5.bft` | 10194 | `a6fdca63165c22d20fa9a05b18abeb26e4ffb5fe4ec61731cc84235989240af1` |
| `fonts/Assets/aafonts/arial6.bft` | 12484 | `dd6b3b4e7d8db3703a2459c88da6893d1261ee0972441ef42c015ff623fc6356` |
| `fonts/Assets/aafonts/arial7.bft` | 14800 | `0f162ca3497426b16cb4e326d7eaaccc8901069b2180d77786de41a475f13c8e` |
| `fonts/Assets/aafonts/arial8.bft` | 17231 | `1a3eba70b98929ea28eb9e0904739357e5571856ebc309fae1f7062dcd8f56d3` |
| `fonts/Assets/aafonts/arial9.bft` | 20995 | `44eaaded6dfc040d22c4075411cbe117579d464910e6c52053dab4a8987243b9` |
| `fonts/Assets/aafonts/Federation10.bft` | 27843 | `62659274e343bdb7c1216c255e9923c91302523849b956b5a6a385dbc37e7d23` |
| `fonts/Assets/aafonts/Federation11.bft` | 32482 | `ab7a2669b594a14d503b2913d51cf979ca6679afe21e551af71acf1d04761068` |
| `fonts/Assets/aafonts/Federation12.bft` | 36495 | `3731e51f38e5f55ad7ba63357c8a4be42bb7b559407774d712be4e4acca0cad8` |
| `fonts/Assets/aafonts/Federation14.bft` | 46955 | `d9c0d1a7bbe65e477e1250cf4d232c06307307b9e870f7a019fdb16660452fe1` |
| `fonts/Assets/aafonts/Federation16.bft` | 58840 | `12e88bd8335f2d8c572dd01ffbde74e68b3937c49797002816cd9cd3e069c245` |
| `fonts/Assets/aafonts/Federation18.bft` | 71801 | `65cec60f4ed1f94bd0ef8d08f4fa70929bf5a16ac5220dc00ab5d49ad5ccda4a` |
| `fonts/Assets/aafonts/Federation20.bft` | 86081 | `1d25e4c89387de921b098acb7fb3f7494835a73ddc23df90e8310eac4b4e6cfd` |
| `fonts/Assets/aafonts/Federation22.bft` | 101971 | `9c5daefdad85da6aa755fec4be18b4fb85cea7952bf630e647f4afdc661b4a17` |
| `fonts/Assets/aafonts/Federation24.bft` | 118586 | `0a8113ef188f4984857d5e2daf47e6bf54aeb0abb3e153742a6cd28751608a08` |
| `fonts/Assets/aafonts/Federation5.bft` | 11806 | `e905527e1eeca560a237a872e6ea7ee14cadc01808a6032c46219fd69032227b` |
| `fonts/Assets/aafonts/Federation6.bft` | 15133 | `82531c92f0927ab0b9b4110ab3038e2c2554a4fd5a1df4125cdc300dcfbf5c3f` |
| `fonts/Assets/aafonts/Federation7.bft` | 17599 | `a6210c6ec63c08a0537724e94f4d6487a81650fe154c40f5b09de28d239a8896` |
| `fonts/Assets/aafonts/Federation8.bft` | 20490 | `821558a1d45d239c7228cfcd031c5fe50209b132f8eaeee6e4485cfb9f3e5311` |
| `fonts/Assets/aafonts/Federation9.bft` | 24426 | `0c710abb220749362c05b3c7992e1ba09225490f6e0387e5927da48320f76b1b` |
| `fonts/Assets/aafonts/gorn10.bft` | 21254 | `25f8e0fbd655f594e7bccbbb72177499ae6b4b4c9f2d1959b5fa848db75f02e0` |
| `fonts/Assets/aafonts/gorn11.bft` | 24825 | `82c6d10eb6fa499d37ca148354ca48954452aebee75562c3487366403bbd56e8` |
| `fonts/Assets/aafonts/gorn12.bft` | 28205 | `e72b6a398916695141206d7b27b8f1c3feabd0b0bfade2acd5a3949aac9a3419` |
| `fonts/Assets/aafonts/gorn14.bft` | 36140 | `c03c1d728f3ade1a90c133036161ab6ad470cca6bb8aaaf36edb59d436d90086` |
| `fonts/Assets/aafonts/gorn16.bft` | 45159 | `6b523c6a138cbab649981865d5ecb24feacab72c4e28de9c1cd3bd1b8a7e3fb9` |
| `fonts/Assets/aafonts/gorn18.bft` | 54967 | `e321eb843be9e1b4674c2646f17588be533bd5ac5c344e947fde0b330eabc495` |
| `fonts/Assets/aafonts/gorn20.bft` | 64967 | `7948627d0c72121d051d13d9c8aebe5b70fa6f3011ab2605c36053b59e7c2339` |
| `fonts/Assets/aafonts/gorn22.bft` | 76275 | `f40ef969d30caaf24520959fb1d35dcd004fcc8be07e129481a4d0da954cb27b` |
| `fonts/Assets/aafonts/gorn24.bft` | 88023 | `1af06f36f56ff1d516b007c495e4883d91ae1605e5a8150ce0946b69aec52d81` |
| `fonts/Assets/aafonts/gorn5.bft` | 10177 | `ac73ed476412fe96c38c8047578cb16ae8074ab56c679c8c601d5b1b4454c03c` |
| `fonts/Assets/aafonts/gorn6.bft` | 12172 | `e5513374c9929f0bc9749331e981eeef1ef24fe318132171812d98cdc861d8c9` |
| `fonts/Assets/aafonts/gorn7.bft` | 14519 | `37d18cff2f0848cb86e692b8edab1af776b578d72115b4517af9373243971a6a` |
| `fonts/Assets/aafonts/gorn8.bft` | 16192 | `11b855c25c9c67dc253809f1333ff55c619d1c3622193db80628db02e63b210e` |
| `fonts/Assets/aafonts/gorn9.bft` | 19086 | `f2724632e3512ff47d8ca83716141e73d1b56cd9f97a7dd57ec5194363b28c56` |
| `fonts/Assets/aafonts/hydran10.bft` | 30266 | `08a8baca35a4f423e4265e0ac3f2e68710a600c45293951b065e5a5920633445` |
| `fonts/Assets/aafonts/hydran11.bft` | 34411 | `78003a4f39deef4a794836105990ad7f0f2f3531a2ce6d77d1d919bf57d30ed8` |
| `fonts/Assets/aafonts/hydran12.bft` | 41596 | `e596165d1f6d84334223db393aebfc60bc3aa7f4ec1c5f69a10e0f7a17c54053` |
| `fonts/Assets/aafonts/hydran14.bft` | 53399 | `95096549cf8fa038c32d53c384ae15e0241bae5d1c8f154393507b2c8080e025` |
| `fonts/Assets/aafonts/hydran16.bft` | 66239 | `cc3144a3a370a94cc3257e1eb04f0d0e724b3b2ef918029d5da1180c10fa3141` |
| `fonts/Assets/aafonts/hydran18.bft` | 80399 | `8fc0143679776a708f02c021c76da2ee6260842eec860efdd62527a0e99c8d4b` |
| `fonts/Assets/aafonts/hydran20.bft` | 96021 | `4e7b92e32edebf7ac662e3c6fbc052c7718f76fceb438a7d7e22bb6c8fdcfd80` |
| `fonts/Assets/aafonts/hydran22.bft` | 115974 | `bf20559d5b0122185764cece76c632c55a8d9b89c60fb806961932960815bd36` |
| `fonts/Assets/aafonts/hydran24.bft` | 135587 | `08def19e6970b0d3e80f0a0e08a8581798b1b8c29c50c359dbd6a1bc486b370b` |
| `fonts/Assets/aafonts/hydran5.bft` | 13017 | `ea2fa7251fc74ab17574a587e4e623863156d6f5bbe4be3d6d3a169c124ee190` |
| `fonts/Assets/aafonts/hydran6.bft` | 15089 | `e63ddd6c6b1d2820870dd1149a1602032a0b5e0f436fe0082fdc31c5ad2f8c0a` |
| `fonts/Assets/aafonts/hydran7.bft` | 18642 | `fdc2cae33aef3b6c8443264e9ca8b2a0cb0d79ae36a5849cfb6268ba6bef4c6c` |
| `fonts/Assets/aafonts/hydran8.bft` | 21083 | `7fd7ce203c69ecefc57ac28a7ad1c3678bb0c6f4d187b5f22b077671983ee3a1` |
| `fonts/Assets/aafonts/hydran9.bft` | 25853 | `05dc5db167c73043ebf02f07085d569c5f8c6b186db766ecc8d8594ae2b52646` |
| `fonts/Assets/aafonts/isc10.bft` | 24017 | `361dc9303b00bf5d27d4117053969866292af0aa6d03d93993572c49eb986953` |
| `fonts/Assets/aafonts/isc11.bft` | 27830 | `36d5eb1e01dac6c37ece4baa43d4b465dc9f3ba58cafb422264b34650447c783` |
| `fonts/Assets/aafonts/isc12.bft` | 31172 | `33723720bdb057762d0617b36b7814672abc6206847ce29d10bdcaf4f447b2e2` |
| `fonts/Assets/aafonts/isc14.bft` | 39627 | `78cb5590390fcdf6faa5b1efba26c20689fc193969ae1d08b5ecacad7c8c9ba3` |
| `fonts/Assets/aafonts/isc16.bft` | 48786 | `d664d854103195731d2bb8b5c69ec59565f3e4ad35458ecdd3e6132de23181b6` |
| `fonts/Assets/aafonts/isc18.bft` | 58978 | `808b80e59143560d26aba842270101f534cf1cf9b5442adccd44b590f5635317` |
| `fonts/Assets/aafonts/isc20.bft` | 71038 | `06219c90d607efd1cc1fe60225e9db9011dda55ba1c94afd19ad4e4242d95df9` |
| `fonts/Assets/aafonts/isc22.bft` | 84152 | `e850d00d2994ed023d3a991152e3bf138217683e332000361efb3ca5da475262` |
| `fonts/Assets/aafonts/isc24.bft` | 97625 | `f8f1639f8513a8f61e8d65f7d86576f751ed618a0d79b1ad8e834bf18ca6fce5` |
| `fonts/Assets/aafonts/isc5.bft` | 10630 | `14f4f778b57e0532b05ff9dd25e03fd915dcf4c45bf5c84fcc8880b41cad467c` |
| `fonts/Assets/aafonts/isc6.bft` | 12973 | `9f27d5831bd96ae0291624c056c8b1e060afd083b0784a2772168439eae0adc9` |
| `fonts/Assets/aafonts/isc7.bft` | 14683 | `0f086a631fd7ab6e172f455ab76600c7449cdef558638fb7efe2fb37091e9730` |
| `fonts/Assets/aafonts/isc8.bft` | 17265 | `d0af5b3f22b12421399a2b9f8ef7343e2fbe578aab784b94f2548fd09082dbf6` |
| `fonts/Assets/aafonts/isc9.bft` | 20405 | `46026d3fb73d987c89a342c97801bf516a2c8a045ac4b210a5169b6fc98d6cae` |
| `fonts/Assets/aafonts/Klingon10.bft` | 23794 | `fa86495fd060e14366f254caf903f377046f79edded2273983fb0f4c126b17c0` |
| `fonts/Assets/aafonts/Klingon11.bft` | 27783 | `5c166ef4a2efb41acb6d03d66207bf8b3cb7ccc8a0738aa757b08148d2f42375` |
| `fonts/Assets/aafonts/Klingon12.bft` | 31047 | `30de3afca8bf5585db8d483317e8682ada107124241cf3613a47c0a430698114` |
| `fonts/Assets/aafonts/Klingon14.bft` | 39768 | `7ac68be372d3f6618a3db5ca735263ee5f82e6bed3b1400fbbff37d427f80468` |
| `fonts/Assets/aafonts/Klingon16.bft` | 49134 | `5b8e9454f5828b4201bb81ecd2a220ba81e6bd098e969ddf4cf718ebfe5140f2` |
| `fonts/Assets/aafonts/Klingon18.bft` | 59378 | `f269fc08ac12727fb40586a40fc8ad29ce21f1c882cf32345eee42791b1e9a91` |
| `fonts/Assets/aafonts/Klingon20.bft` | 71028 | `3def44bdec6e5996dd69c948b0b0b32c816edeb200d390b7afe4287d27fbdfa9` |
| `fonts/Assets/aafonts/Klingon22.bft` | 83739 | `55c63b7507db232e1b82300f55c120402776f8205fdf6e2f4324ebebea81fa9a` |
| `fonts/Assets/aafonts/Klingon24.bft` | 97784 | `a5aeecd60734028a6edbad1e9fbf4d80f1d0f9a02284f97ec0a047a352a20ce7` |
| `fonts/Assets/aafonts/Klingon5.bft` | 9675 | `3056cd1881e9290f0acd5ea865e579aefa890d9b92e428f06f63863e95029e57` |
| `fonts/Assets/aafonts/Klingon6.bft` | 11417 | `e131233880e0938ee0b402d80281b67a063b425b97dcbb5a1a827890896e45e1` |
| `fonts/Assets/aafonts/Klingon7.bft` | 15120 | `7b0d2da5e8b8bfb5fafe2b7143269842d2f1af92bbcd4cb836dec228d967d72e` |
| `fonts/Assets/aafonts/Klingon8.bft` | 16955 | `4fbe4f4ab81510802e2df8062f8824064b10122ba72c46031799d3cb4d4daeb1` |
| `fonts/Assets/aafonts/Klingon9.bft` | 20282 | `540a051fa1ef66bddf0b092c0f83e4499056e4d6e50a0eb62ee2649c8dd1e1bd` |
| `fonts/Assets/aafonts/lyran10.bft` | 23931 | `8997ded76b7e049015a4bd592d5cafdf3f1b6ee9872dd0050472774398d4527b` |
| `fonts/Assets/aafonts/lyran11.bft` | 30442 | `3ad77df17075dfa597532a7b9293c4db7441b1d2d267c7c2bf606ec8c2b6ba82` |
| `fonts/Assets/aafonts/lyran12.bft` | 34905 | `641e37af5cfbe9e2c18e6dbaf90c94748bb15327d4495972590fa7376ae7653b` |
| `fonts/Assets/aafonts/lyran14.bft` | 44812 | `8611f51152fad4b42b33925b816be07242abfe05aaf222b2eb82c0a611cb4d62` |
| `fonts/Assets/aafonts/lyran16.bft` | 55544 | `7a0af629dd34efd50380cda49e780d7e594239300a54fd84a987320af31cd108` |
| `fonts/Assets/aafonts/lyran18.bft` | 68426 | `b431451982521cb5d82490a1f137836caf7638b42ac2913a5246c022e00354e8` |
| `fonts/Assets/aafonts/lyran20.bft` | 81231 | `b75e16b306a6637b339ff4d7f4ab44af2382325d8083c626111629c8377fc278` |
| `fonts/Assets/aafonts/lyran22.bft` | 96163 | `3d5f11018ad50edb01be19489f2bd9571c064570254e4fe26e1d508dfc09ef49` |
| `fonts/Assets/aafonts/lyran24.bft` | 111969 | `9314ebbe2f227ed5f31f9022292423376585c51a8ced0ee646535c2aae7c5a31` |
| `fonts/Assets/aafonts/lyran5.bft` | 10388 | `8e930924d9e3a8a66c6f8733a45fb2f4a1f994d31b5705ee5da7b4d8d32ae119` |
| `fonts/Assets/aafonts/lyran6.bft` | 12532 | `d0cf50f7c1e51daa6e7aa19e5507e27bd53097f107af3cba7e02c25eeaddb960` |
| `fonts/Assets/aafonts/lyran7.bft` | 14911 | `84ea0d8471f465763b907336177010cd554cd4d7e849a88112492e143cb3f41b` |
| `fonts/Assets/aafonts/lyran8.bft` | 17376 | `2e1d1a23cab2ce915185955797a659dd6d231b99d2355883ad2b1768995a6635` |
| `fonts/Assets/aafonts/lyran9.bft` | 20353 | `d35a82e2e42e9ced5ec2e5c1856b5506a932512dd2f034f145b4f865fa0005ee` |
| `fonts/Assets/aafonts/mirak10.bft` | 23242 | `8fcdc2bc2c34653e23fe778bc03abe023cc268eb1080f5d70ff38d2f6963766b` |
| `fonts/Assets/aafonts/mirak11.bft` | 27213 | `22c07d39aadd7aa07547a39c7a79d1e119a1d7c489e49262af059120758ff19f` |
| `fonts/Assets/aafonts/mirak12.bft` | 29786 | `b5454d942d1b59b410838d43a226b4871a9a109627698051ad44a3bc7e568be9` |
| `fonts/Assets/aafonts/mirak14.bft` | 37969 | `b2cb11de4496ed62e4cce9c1568220238590aae8630f4255b2cc858b024f9ffc` |
| `fonts/Assets/aafonts/mirak16.bft` | 46993 | `c9b17db439dd7f269e17fac0a8d776150759d81b8a0a8c5ba7d1fd42718f73e6` |
| `fonts/Assets/aafonts/mirak18.bft` | 57179 | `64374a424eed254f9a30a4d499eb2c679d723f9eca61acf5e94dcc034c40ffbd` |
| `fonts/Assets/aafonts/mirak20.bft` | 68732 | `3f95331f7e56521ec174357490fedaf7ed1dfdd53fc0239b01c88e6366f44016` |
| `fonts/Assets/aafonts/mirak22.bft` | 81109 | `db86fa0c4afcd14c198d7fef724a462b8853ae30d8771b2526800cf46375a67f` |
| `fonts/Assets/aafonts/mirak24.bft` | 94257 | `b52ceea155dbbacb01dc8ce1a7a73448d3ac304f79d6deddaf1ef364e44e6f82` |
| `fonts/Assets/aafonts/mirak5.bft` | 10653 | `e9e51955ee1bed2309d8ab87ffc66aeea0188ec8942aedb6af73185dee591be1` |
| `fonts/Assets/aafonts/mirak6.bft` | 12572 | `833664855f982c0b89f521383300aaf9bc9ddc68153e6d17a0215af87d0a7699` |
| `fonts/Assets/aafonts/mirak7.bft` | 15109 | `018458ccc39d1e106e77fb96cea403a324e4a716c08a8ae4ca9f57c3800e4de0` |
| `fonts/Assets/aafonts/mirak8.bft` | 17425 | `e5b9b35ab6199c2d5955018732b36a2b367e404cf468e9b1d2b229cf3e78f645` |
| `fonts/Assets/aafonts/mirak9.bft` | 20738 | `fa66f26950a292f99b5d0ca55297aeac1893e2ba1a156f5895734efbb40c94eb` |
| `fonts/Assets/aafonts/romulan10.bft` | 28221 | `e1e644c128db1cd25ecda17aea250a3fcf4a53a24466a4ed623dd452715cca72` |
| `fonts/Assets/aafonts/romulan11.bft` | 33047 | `a441528bb3d7e365768255051fc1f7345d7447d41206f7bab86256dfc8faffac` |
| `fonts/Assets/aafonts/romulan12.bft` | 38061 | `c5bdbebd1ac3c19e6ef98c8f44e20a8b421f3b8c451e9965f6f6e40cd2127d8a` |
| `fonts/Assets/aafonts/romulan14.bft` | 48300 | `b817d872361b871e276eddeaa6d8573a8ab473775596814c1f2e53f9851e66a9` |
| `fonts/Assets/aafonts/romulan16.bft` | 60085 | `1fa1bd2cdb93b0f46db65edf7b51fdad53275567bc44d39e38ab88e42afd5ab5` |
| `fonts/Assets/aafonts/romulan18.bft` | 74527 | `73b6f3e70782f8393e220a6a9eca1ba90ec342cd966020a96dd44b690ba2c0ca` |
| `fonts/Assets/aafonts/romulan20.bft` | 88133 | `20505e429db5b8d00b9551c6aa17233b902ef26a55e8808574c5608bb98987fa` |
| `fonts/Assets/aafonts/romulan22.bft` | 104321 | `464ea6b42aa713d1276d85527ec6ce80eb95d2436054d8ac8bcb735603bc629f` |
| `fonts/Assets/aafonts/romulan24.bft` | 122416 | `ccb2e008d881e9bff17549cf58e62c5f70691cd846b3da868a04638a441820bb` |
| `fonts/Assets/aafonts/romulan5.bft` | 11755 | `02ef07537663e92114f85c6814d62d0b24bcce3a29690f6bdda4a81cc373bd54` |
| `fonts/Assets/aafonts/romulan6.bft` | 14501 | `ef967eb96267323c8b29a66d4a4271765e8caeaf11808b0b04d66f38003be30b` |
| `fonts/Assets/aafonts/romulan7.bft` | 16825 | `a1f909571340c8159d33becab526b1817c78f927a98e90a767fff3af40303c64` |
| `fonts/Assets/aafonts/romulan8.bft` | 19915 | `bb3a193acf4fb6ef36cc29787eefbbae03b68f0708ad3b6b63bce9add259091d` |
| `fonts/Assets/aafonts/romulan9.bft` | 25172 | `0c76491ec1ec21861d2b6616e47546cdb2807bd9f3510984c44f5d05e73812bd` |

### campaign-or-conquest

30 path(s).

| Path | Size | sha256 |
| --- | ---: | --- |
| `other/Assets/Scripts/Campaigns/ConquestBonus/PlayBonus.bat` | 2196 | `e3e6755fad354f135038a0a2d1f9bbd6a374ee001f1877dad53b743f894625fc` |
| `other/Assets/Scripts/Campaigns/ConquestBonus/PlayNormal.bat` | 2191 | `08b7dd279250676156ef716cbd346aa021a24117b8e38b982fd0ec678eef10d8` |
| `scripts/Assets/Scripts/Campaigns/ConquestBonus/Conquest Fed .mct` | 814 | `105cdb53f8c8d9dc1624efa4447b29bfc60dd91297603d8c2dad25d1e9fa0396` |
| `scripts/Assets/Scripts/Campaigns/ConquestBonus/Conquest Gorn .mct` | 814 | `5faa76544c366a59a858f8f5965f061b4f0ad28bdf99f7370ed5e70579ec5a0a` |
| `scripts/Assets/Scripts/Campaigns/ConquestBonus/Conquest Hydran .mct` | 816 | `0af79229f059bac526c06b1912be7d6c2d211200fde03187b197e551e007faca` |
| `scripts/Assets/Scripts/Campaigns/ConquestBonus/Conquest ISC .mct` | 813 | `9364bddd79f6e73a25c26fc18c6e3e68f96a5af0f39247bd5f893b40ba69f002` |
| `scripts/Assets/Scripts/Campaigns/ConquestBonus/Conquest Klingon .mct` | 817 | `c3a39186e97a5aba738a6841139cf88ab6cd3ff88fdcccfdb9935cbd97148ed1` |
| `scripts/Assets/Scripts/Campaigns/ConquestBonus/Conquest Lyran .mct` | 815 | `29edce004de04c8e19f78ee2354b2818a59fc3c1f9374ebcf1795b8ac6ae1dc0` |
| `scripts/Assets/Scripts/Campaigns/ConquestBonus/Conquest Mirak .mct` | 815 | `8f054406207baf231d7a07d3dc11b206e44c320bcb8217cdda10e06c32f8c969` |
| `scripts/Assets/Scripts/Campaigns/ConquestBonus/Conquest Rom .mct` | 817 | `a8a0fe5ad926001bc8486821f9abfef3740261fa74f0b250fe54dc8c753e728b` |
| `scripts/Assets/Scripts/Campaigns/custommissions/Custom-Federation.mct` | 826 | `471a0685903af6cdf6d60430e76bfb197da63fc273b330db840c2986fee72322` |
| `scripts/Assets/Scripts/Campaigns/custommissions/Custom-Gorn.mct` | 819 | `76dd39eef1b5a7b917c554e21c7c5c2f7712a4d58944a34ecd96c5ef2964f0ec` |
| `scripts/Assets/Scripts/Campaigns/custommissions/Custom-Hydran.mct` | 825 | `9046dcaa2f8c9a6d56c9ecc7944d943fd5a83a921a6ab7e9b9bc90aa58b656bb` |
| `scripts/Assets/Scripts/Campaigns/custommissions/Custom-ISC.mct` | 814 | `50b9c1cd70c41b5c08cfacc298411b132212c727c04642c71ba23eaa53689dcb` |
| `scripts/Assets/Scripts/Campaigns/custommissions/Custom-Klingon.mct` | 835 | `21ab0b548fab3ca176983b5eaf05e426de7207a82b7cc811834de9c767fd4c5e` |
| `scripts/Assets/Scripts/Campaigns/custommissions/Custom-Lyran.mct` | 824 | `4b0914688bb19294ed9260ce03e8542be800834963a674166ee5d5280b58e03d` |
| `scripts/Assets/Scripts/Campaigns/custommissions/Custom-Mirak.mct` | 821 | `4b3fee67b710a39665d4520050c1e8a56fef6fc9521759453abf1f55afda0a06` |
| `scripts/Assets/Scripts/Campaigns/custommissions/Custom-Romulan.mct` | 837 | `0f4731bd5a029faff59d1aee717927bae7f87df00e3187c2eb1952b215135af3` |
| `scripts/Assets/Scripts/Campaigns/ISC-Fed.mct` | 1366 | `1d0a51458b9b72a67fa2d2a2ccd76391206f4a24e9350c67cf3a8efdbdcf7102` |
| `scripts/Assets/Scripts/Campaigns/ISC-Gorn.mct` | 1379 | `26a395db2871900d87ff404c2832d71b81c5a395cab1a3b69a88350b22567efc` |
| `scripts/Assets/Scripts/Campaigns/ISC-Hydran.mct` | 1288 | `66ce18e24b91ed8f31378bdf3f25b939ac7b78faff0bb7ae09fb08318edd4b09` |
| `scripts/Assets/Scripts/Campaigns/ISC-ISC.mct` | 1228 | `87df7f135351caa8998f40b90b36787355447f8ea03e949f89db11480bbcc8d1` |
| `scripts/Assets/Scripts/Campaigns/ISC-Klingon.mct` | 1274 | `17b7085cd0511b8acd2a3e5da7a0f6174a8731b62a4bc2d86aaf65b162e3f895` |
| `scripts/Assets/Scripts/Campaigns/ISC-Lyran.mct` | 1306 | `420aa3ef30c19b221fbd9706e6fbe9a3415eb5c0f059c5e6f732163c483a54d4` |
| `scripts/Assets/Scripts/Campaigns/ISC-Mirak.mct` | 1305 | `5003972b1c11c70cbbd8181cd3238d22e8fca30e03e79331d5c2aaadaa2f7f89` |
| `scripts/Assets/Scripts/Campaigns/ISC-Romulan.mct` | 1347 | `9c9bee9d97488022259926f799f1b46d0a65ab420b443735dd36566747be4953` |
| `scripts/Assets/Scripts/Campaigns/Mirak - Hydran.mct` | 1192 | `bde8757c3224bd11e73d0934593eae2901f7186af820c9c272c4ffd56c967441` |
| `scripts/Assets/Scripts/Campaigns/Mirak - Klingon.mct` | 1194 | `5393ca6ef8f72e37601ff9c7e6059e819a8bdef3edbfee8bb6a5f15948347014` |
| `scripts/Assets/Scripts/Campaigns/Mirak - Lyran.mct` | 1173 | `9004007a5136e50988f81b82241a8e16b1297802c38ea97f0b2b5a33514f8823` |
| `scripts/Assets/Scripts/Campaigns/Mirak - Mirak.mct` | 1162 | `88616ba9aa1126c4176e0f325f5d8220f64bbf107ae6a13120c5524049c1a1d2` |

### extensionless

166 path(s).

| Path | Size | sha256 |
| --- | ---: | --- |
| `tables/weapon_groups/Assets/WeaponGroups/F-BB` | 118 | `6a9b81920b29a0c68a94111fb11b16e2f35a9ac315b44812a23ac9f3e9e7290b` |
| `tables/weapon_groups/Assets/WeaponGroups/F-BCE` | 132 | `808296a3483486a43c44eac3a71c4bf1d1faa149bd20bdbdaf6884c2a8f3caa5` |
| `tables/weapon_groups/Assets/WeaponGroups/F-BCF` | 98 | `34acb998ae9611d8a82264e584d0653edccf0068c9f7c8b311b03ae576aa39a5` |
| `tables/weapon_groups/Assets/WeaponGroups/F-BCG` | 121 | `c01ea88be2647751861db0f3b922bf63abae441ffe66129e87d275f42c9718dd` |
| `tables/weapon_groups/Assets/WeaponGroups/F-BCV` | 121 | `d84a71e02c13613221450843c6c6021455fd90fb04935414be169d69e5bd484a` |
| `tables/weapon_groups/Assets/WeaponGroups/F-CA` | 106 | `5311ef3f413a18c715ef5656440f9b4aa964516d757eb64be3a265070c19cd54` |
| `tables/weapon_groups/Assets/WeaponGroups/F-CAD+` | 112 | `85a43c681b6cec1d296a81d1ce0f1d705c96b38005ee9f47a0a8356df33d4737` |
| `tables/weapon_groups/Assets/WeaponGroups/F-CAI` | 106 | `1ef7e1e3215a22099d7f0cb5e2015e9309b1a89dfcefef7fef5751c181a4920e` |
| `tables/weapon_groups/Assets/WeaponGroups/F-CAR` | 98 | `508dd3fa83f5fb58b51aabf0686313b81a3c1fa5d48f7cbc4819991da8713979` |
| `tables/weapon_groups/Assets/WeaponGroups/F-CC` | 114 | `025a6b5614bf92db522225b900f113a1aa920ba7fdf98ec30d71349ead0d4891` |
| `tables/weapon_groups/Assets/WeaponGroups/F-CDW` | 98 | `379a1e7ea99fd40d12556860eae2c9d44df7e98d0a0d5e421184f9a96847630e` |
| `tables/weapon_groups/Assets/WeaponGroups/F-CLC` | 119 | `e3aff8629a546dc1ce8db23a4189db9f705cca3ee0e4ed0f7e91a0e2776f043c` |
| `tables/weapon_groups/Assets/WeaponGroups/F-CVA` | 115 | `f6cf8b9a334fdabe9cc1d5152c79443a92f39a3098d8c7eb495c039ec6637ce5` |
| `tables/weapon_groups/Assets/WeaponGroups/F-CVL` | 101 | `8d16bc176327cd2f9924785c5d3faff56eeaa5098e9e5a257086466cd8a56f70` |
| `tables/weapon_groups/Assets/WeaponGroups/F-CVL+` | 93 | `fc0606ab5021f9cbda0efb346d6653a929e4bcdedfa274e61979651355bc5e47` |
| `tables/weapon_groups/Assets/WeaponGroups/F-CVS+` | 105 | `faad250ae99903fa3ead5da58f54c8b770dc21ba581aa69f2431e6b8cb2131d9` |
| `tables/weapon_groups/Assets/WeaponGroups/F-DD+` | 110 | `5067abba54a01229adf82c07c6ad85414a9c589f37a72f278f58bf9ae40e736c` |
| `tables/weapon_groups/Assets/WeaponGroups/F-DE` | 111 | `d35143d32c53f0b5b527a0793bf8293eb4ba1e089265f8f4f676f6670ec28b79` |
| `tables/weapon_groups/Assets/WeaponGroups/F-DER` | 105 | `2e3517c6efa49e4b14c6f6d2e2fc584581c5630f359532dea983281920763b5c` |
| `tables/weapon_groups/Assets/WeaponGroups/F-DNG` | 131 | `b0eea47c157e3498f923d89f3276768011ae10ee31321df2cd2dcf7b260fa038` |
| `tables/weapon_groups/Assets/WeaponGroups/F-DWC` | 103 | `5ad7a9afceb9f21c21b0f630f499be81d508259a211db4e1b51aefadd17b6ee1` |
| `tables/weapon_groups/Assets/WeaponGroups/F-FF` | 114 | `971436774930912ec4db8cb4a8e43251d6d0547a0c3f767be84e973e72832463` |
| `tables/weapon_groups/Assets/WeaponGroups/F-FFB` | 119 | `5ba977a8a6d9aa40e9e679a7085918066cd9eedd5c073085657e35cbf1af6aca` |
| `tables/weapon_groups/Assets/WeaponGroups/F-FFD` | 111 | `0c9185498fc7a6c975e560f789292e0f17af3a0d5704d0429ab48b6f2bf75af7` |
| `tables/weapon_groups/Assets/WeaponGroups/F-FFE+` | 119 | `91f3284777a605b2de7aca5064d8a8399fcbe57ec13a460a347c2949a4141e2d` |
| `tables/weapon_groups/Assets/WeaponGroups/F-FFG` | 119 | `5ba977a8a6d9aa40e9e679a7085918066cd9eedd5c073085657e35cbf1af6aca` |
| `tables/weapon_groups/Assets/WeaponGroups/F-FLDr` | 108 | `6291ce73dde1483a32413bfb95c00c55d709867620ab3ef7f479def36a22988b` |
| `tables/weapon_groups/Assets/WeaponGroups/F-FQS` | 92 | `9a4130a96baa571443f75e50f11301948db6535b0cd233cc4c798dd463a283a1` |
| `tables/weapon_groups/Assets/WeaponGroups/F-FRD` | 70 | `34bf5f1198c84bc73b6badeced8078c499289e7de65a454c2d65e75ee8e434d4` |
| `tables/weapon_groups/Assets/WeaponGroups/F-FSDr` | 84 | `172423148364da9a03d1df1c188525ba1f29cf16639e44b872cd4611abbf4846` |
| `tables/weapon_groups/Assets/WeaponGroups/F-FSML` | 78 | `3780c608520028f448c71dc2e5b15ea70130dbcff9628df61ccc6e4b6298770d` |
| `tables/weapon_groups/Assets/WeaponGroups/F-NCC` | 117 | `76e61689f0f76b798a708f485552c67afaa7ffa8982ae14634c8646282e6d3b6` |
| `tables/weapon_groups/Assets/WeaponGroups/F-NCD` | 109 | `f21b79ea14ce2bca88b0f258e60dc6aa4a6c937934dba1d61ac623418fc5222e` |
| `tables/weapon_groups/Assets/WeaponGroups/F-NCD+` | 119 | `f8f4b63b6f1b995507c599b81dd2dc02a048731a70d64dd593d03ae43fa7981e` |
| `tables/weapon_groups/Assets/WeaponGroups/F-NCL+` | 109 | `95098795513ca2c9ed48f3010bde7e01386f97650e92498e3467e53d8f41ef14` |
| `tables/weapon_groups/Assets/WeaponGroups/F-NVL` | 91 | `a7f8a7086ceec78e2c057ffb7a2c94d29a71a9f45008469c12f23db272e1e7b4` |
| `tables/weapon_groups/Assets/WeaponGroups/F-POL` | 88 | `d5e3af4e9c63757424cbf6cee0d4257a95394f4587866fea12bbfe232e62871a` |
| `tables/weapon_groups/Assets/WeaponGroups/F-POL+` | 105 | `f46844d9f7304002b241e918bfc94ab53670f1541dcb1b9157dda1cb56af5cf9` |
| `tables/weapon_groups/Assets/WeaponGroups/F-Pres` | 92 | `b5973c2aa67648530ae87b0978b8a4f2e182e7d5e01934dd6fd9084b136a99c4` |
| `tables/weapon_groups/Assets/WeaponGroups/F-SH` | 76 | `26da091719035f70c27845da8caa6baef6d6acae891f0a437f80a604b7a5a7cf` |
| `tables/weapon_groups/Assets/WeaponGroups/G-BDD+` | 120 | `932f636f3607e0011dbaf1c82a89864502d5212c07c8cee4ac61a5d1a142fda2` |
| `tables/weapon_groups/Assets/WeaponGroups/G-CS` | 132 | `e6fa975e8d5a2b39bd49694a27c9871f4df633178dce64b30f2eea50da6a710b` |
| `tables/weapon_groups/Assets/WeaponGroups/G-DDL` | 100 | `f5172faadd2f9b653d704a58741eed601f9f581ea2a44351cd57412b1e1dee5c` |
| `tables/weapon_groups/Assets/WeaponGroups/G-DDL+` | 116 | `582dc5a93152efd45184513c6e2cabbeb326d07bfe392f23ee0a019d21437a0f` |
| `tables/weapon_groups/Assets/WeaponGroups/G-MCC` | 138 | `6885b8085490e7526f919308367363a45074130063c5712f9b3bd7633b38e7a4` |
| `tables/weapon_groups/Assets/WeaponGroups/H-APA` | 118 | `6224fe3811ba2d281c1c46f0a01b5418c7547231e457420032064c35c6252b29` |
| `tables/weapon_groups/Assets/WeaponGroups/H-CU` | 116 | `6121b6e972aa2c2bfef01621cd83c92c66700601cc8966fcdbe3e5fb1644232b` |
| `tables/weapon_groups/Assets/WeaponGroups/H-EH` | 118 | `b839361e56739d297d336f7ad833862f528ef2714b296ace90937052d33cf611` |
| `tables/weapon_groups/Assets/WeaponGroups/H-HN` | 114 | `bc5092d30d4fd055fb0652e91dafe95306336905bf755b072301f5cd086960e1` |
| `tables/weapon_groups/Assets/WeaponGroups/H-HR+` | 118 | `66814fbe033007f3c182f6dba43f2980a4c9ddc5bcc7818638fbb6836ace9302` |
| `tables/weapon_groups/Assets/WeaponGroups/H-KN` | 122 | `010240fe57e1a822684e429fe2edbd88f76fd96eba35b91849e6fa03e17e1f2f` |
| `tables/weapon_groups/Assets/WeaponGroups/H-TR` | 122 | `6b4f1ba89fe47e3987dbac7680e67f161cd3e1d8bcc344d55b739e9d472587ea` |
| `tables/weapon_groups/Assets/WeaponGroups/I-CAP` | 93 | `16e94687693882f30ec0021aefbfe32cafdeb439d11db594ff4951f61b253ea2` |
| `tables/weapon_groups/Assets/WeaponGroups/I-CAZ` | 132 | `d162f2f504ee5399ed2fa938b6ee1704d1603a6debb2bf13b2a7467f725f266a` |
| `tables/weapon_groups/Assets/WeaponGroups/I-CC` | 120 | `aa8e7e877d6520b080da26d15aebff89fb57b80931d895f3018fcd79066687eb` |
| `tables/weapon_groups/Assets/WeaponGroups/I-CE` | 114 | `7d4ca4373b0e73164b1a4b525aed4ff2f0fdc6d50050c723e31cb35dab2bc43d` |
| `tables/weapon_groups/Assets/WeaponGroups/I-CL` | 94 | `c4bd53c288fafa7db0445926f9eee423fd05e6e970ede276553dc066744d67ae` |
| `tables/weapon_groups/Assets/WeaponGroups/I-CLW` | 110 | `5d7ed84a30593bd5f11a5b758c336c87b3231dbb45f3a9bd3fb08ffbbff50075` |
| `tables/weapon_groups/Assets/WeaponGroups/I-CM` | 110 | `5d7ed84a30593bd5f11a5b758c336c87b3231dbb45f3a9bd3fb08ffbbff50075` |
| `tables/weapon_groups/Assets/WeaponGroups/I-CMP` | 110 | `5d7ed84a30593bd5f11a5b758c336c87b3231dbb45f3a9bd3fb08ffbbff50075` |
| `tables/weapon_groups/Assets/WeaponGroups/I-CSP` | 110 | `5d7ed84a30593bd5f11a5b758c336c87b3231dbb45f3a9bd3fb08ffbbff50075` |
| `tables/weapon_groups/Assets/WeaponGroups/I-CSZ` | 122 | `0ffa7e155950a9f157e9193d77dcc6499e3cf358c097a22ef593d3f13ed60ab4` |
| `tables/weapon_groups/Assets/WeaponGroups/I-DDGZ` | 112 | `906e07bee4a0703041b2e5bf8b57b159de11a93720d3d4b42d7947e566b96eb0` |
| `tables/weapon_groups/Assets/WeaponGroups/I-DDL` | 106 | `215b6111822a7935e02935a919b2b37ad3a7de64752cf93caa13cee8a9cf0002` |
| `tables/weapon_groups/Assets/WeaponGroups/I-DDLZ` | 118 | `1abb26ea9bfad0ced73b7c288c9fabeeae0583c9ea324c5afacea0b5477a7e26` |
| `tables/weapon_groups/Assets/WeaponGroups/I-DDZ` | 118 | `1abb26ea9bfad0ced73b7c288c9fabeeae0583c9ea324c5afacea0b5477a7e26` |
| `tables/weapon_groups/Assets/WeaponGroups/I-DEF` | 92 | `156abd305ab47735275f6f27fc2d3ad47a03311ecb1123b02fa6b6b40c8ee4e1` |
| `tables/weapon_groups/Assets/WeaponGroups/I-FRD` | 70 | `34bf5f1198c84bc73b6badeced8078c499289e7de65a454c2d65e75ee8e434d4` |
| `tables/weapon_groups/Assets/WeaponGroups/I-FSPh` | 86 | `c42e88ba8e4ad87dcef4b2b83d562cbe57d2f4204880e05ffac26918583d953d` |
| `tables/weapon_groups/Assets/WeaponGroups/I-POL` | 84 | `e681a85cbd987d43384aa6acfbafb8255d42255df76b1313a2cc14a5741283b0` |
| `tables/weapon_groups/Assets/WeaponGroups/I-POLW` | 100 | `a5ed9c01ddc05dd0f430ca695633b87fa2148392eba521dae8dad8a0ee236dfb` |
| `tables/weapon_groups/Assets/WeaponGroups/K-AD5` | 123 | `ba0dbe29c6d1c368626073a62fef71baca77d619bf15530206e64985db2a837d` |
| `tables/weapon_groups/Assets/WeaponGroups/K-C7` | 127 | `a9405c991f176330f23f0299221593bff541a976d14e301a4d95a6d40192b458` |
| `tables/weapon_groups/Assets/WeaponGroups/K-C7V` | 102 | `441581e5624cbeb67ebc2c3083eb1c5d7f2aeda782758950ac02125ff23b0e34` |
| `tables/weapon_groups/Assets/WeaponGroups/K-C9` | 144 | `2639c71a48b092abb4cf37e9516d8ac11a945593b5262a934f2eab658ee772f9` |
| `tables/weapon_groups/Assets/WeaponGroups/K-D5` | 127 | `8880abb0c1e5397d2889f7479932d16bf0d591da1ca45a9ae64ff78665a17c17` |
| `tables/weapon_groups/Assets/WeaponGroups/K-D5C` | 127 | `8880abb0c1e5397d2889f7479932d16bf0d591da1ca45a9ae64ff78665a17c17` |
| `tables/weapon_groups/Assets/WeaponGroups/K-D5D` | 127 | `1aed0ece8d921d0fb8d73264b5be3105ddb602a61f6f78ab94e0923ad01ab556` |
| `tables/weapon_groups/Assets/WeaponGroups/K-D5K` | 119 | `48834db011266fd3b64eccce08bef48508c6d23fa82f51a1e97041f60eeea8a3` |
| `tables/weapon_groups/Assets/WeaponGroups/K-D5L` | 119 | `48834db011266fd3b64eccce08bef48508c6d23fa82f51a1e97041f60eeea8a3` |
| `tables/weapon_groups/Assets/WeaponGroups/K-D5W` | 135 | `23cad964d9b49eccb700bbd1cb3e6209e8de8446e28f55dc216e2a7826d0ad85` |
| `tables/weapon_groups/Assets/WeaponGroups/K-D6` | 112 | `08d3c231081b779f84d4310018d9f37d1839dacf29e63db1122ae961bd24e083` |
| `tables/weapon_groups/Assets/WeaponGroups/K-D6D` | 112 | `6e16807559ff1d925399e609e68044d4b1bede0085b271d4c13f33e0aefe4657` |
| `tables/weapon_groups/Assets/WeaponGroups/K-D6DB` | 112 | `6e16807559ff1d925399e609e68044d4b1bede0085b271d4c13f33e0aefe4657` |
| `tables/weapon_groups/Assets/WeaponGroups/K-D6VK` | 105 | `5d3159a5d55910ef2598e486f54281e702af9a9353c185df4d36df3fbb2b9de1` |
| `tables/weapon_groups/Assets/WeaponGroups/K-D7` | 128 | `70dcfd48a83d3b62668a444fe175eccafb2f3aee9ffa91dd2a3ac7be92c133bd` |
| `tables/weapon_groups/Assets/WeaponGroups/K-D7B` | 131 | `81b03e818fca474e9749b5c8b4effa2a2354b45d382016f4927741f214e984ab` |
| `tables/weapon_groups/Assets/WeaponGroups/K-D7K` | 127 | `27474446261ff45a1c2705da50cad89bda06c1046b058fe068a91bcf0b7007f6` |
| `tables/weapon_groups/Assets/WeaponGroups/K-D7T` | 113 | `96dbaf89127e20fdce632ab71aeccf512384b737bbcafcab9fd6dcebe74e2a22` |
| `tables/weapon_groups/Assets/WeaponGroups/K-D7V` | 114 | `44422456d82e31e5aa6ae789247858e041ae6d574397d65e7c6bcbfd3b5c2a29` |
| `tables/weapon_groups/Assets/WeaponGroups/K-D7W` | 119 | `e449e672b173b32c3156203eddbdee35a9efd7594ade724a1f5b9a8dbb9cc3d3` |
| `tables/weapon_groups/Assets/WeaponGroups/K-DWC` | 127 | `9142721da79f73ef62c6eb9015de06d42b9f0896c778ba4633dafe7fcb1eaa2f` |
| `tables/weapon_groups/Assets/WeaponGroups/K-E3` | 101 | `8b4094c717e62d9c0c1feb1f93135b690cca89e58853dab896618bbf70724012` |
| `tables/weapon_groups/Assets/WeaponGroups/K-E3E` | 89 | `4af424b8ad035f529bf19ea043abdfd56073569aa4c3275eaff55e9f235c7da6` |
| `tables/weapon_groups/Assets/WeaponGroups/K-E3Y` | 87 | `de823e14129162807b0b414de8f158bb4c048aea2e1392c1ee771d21faf59a94` |
| `tables/weapon_groups/Assets/WeaponGroups/K-E4` | 112 | `4448a8d243f5dc1ed78a31d95b5c51653d795a86088de627b3c92e8937b570c5` |
| `tables/weapon_groups/Assets/WeaponGroups/K-E4B` | 115 | `f79559af4151a66b86c6599acae8b7a3f9a023851cb69b0cdc9b903cc154f7b1` |
| `tables/weapon_groups/Assets/WeaponGroups/K-E4D` | 100 | `a269c35dc853cfe0a9a10b1b5ec634c3e09e716422585f24a4a99e6e120631d4` |
| `tables/weapon_groups/Assets/WeaponGroups/K-E4E` | 97 | `1635ac24f83aa5c3431461395470545d113ca99c87ccf9839a55cb70f70efa5b` |
| `tables/weapon_groups/Assets/WeaponGroups/K-E4EB` | 97 | `1635ac24f83aa5c3431461395470545d113ca99c87ccf9839a55cb70f70efa5b` |
| `tables/weapon_groups/Assets/WeaponGroups/K-E4K` | 107 | `09d45777aea93ebc1fa460316056ec5e668fd36e98a629fd24468341c05e0cb3` |
| `tables/weapon_groups/Assets/WeaponGroups/K-E4Y` | 112 | `4448a8d243f5dc1ed78a31d95b5c51653d795a86088de627b3c92e8937b570c5` |
| `tables/weapon_groups/Assets/WeaponGroups/K-E6` | 113 | `fe0143ea908779d7529d134f81ac5f59558398898c884b57bd64cd25256b6077` |
| `tables/weapon_groups/Assets/WeaponGroups/K-F5` | 112 | `4448a8d243f5dc1ed78a31d95b5c51653d795a86088de627b3c92e8937b570c5` |
| `tables/weapon_groups/Assets/WeaponGroups/K-F5C` | 107 | `c035878e5c59f7fc43c8306377ceedf5765c38e6c063922798d7885dbabe88e1` |
| `tables/weapon_groups/Assets/WeaponGroups/K-F5K` | 107 | `c035878e5c59f7fc43c8306377ceedf5765c38e6c063922798d7885dbabe88e1` |
| `tables/weapon_groups/Assets/WeaponGroups/K-F5L` | 103 | `47b0e9f996133ae18d90345b3b6fe76022adc47b6dcd96f7e01667296d0e8b79` |
| `tables/weapon_groups/Assets/WeaponGroups/K-F5VK` | 101 | `afd0921668ad1cbb6cae7a59d65bcf3922bc1bc894947d0552e3056aa6835b41` |
| `tables/weapon_groups/Assets/WeaponGroups/K-F5W` | 123 | `642b29852dd762dafbc1678c90f8dfff6557fac58ae8e30564a6dcc677bee4ba` |
| `tables/weapon_groups/Assets/WeaponGroups/K-F5Y` | 112 | `4448a8d243f5dc1ed78a31d95b5c51653d795a86088de627b3c92e8937b570c5` |
| `tables/weapon_groups/Assets/WeaponGroups/K-FLDs` | 108 | `d9f095dde8856bbbd5aab1574f7bf490621c3ce818d08e14878e9439e0242aa6` |
| `tables/weapon_groups/Assets/WeaponGroups/K-FWC` | 115 | `a13659cb3ef306240b4a44dd5197f0ad9064c168055c0ef7b2f7a606f3ce6025` |
| `tables/weapon_groups/Assets/WeaponGroups/K-FWK` | 119 | `efde90a4d231c5147ca4f2f4dca11ab40fbff7260d96e308146c265d5fe05c82` |
| `tables/weapon_groups/Assets/WeaponGroups/K-FWL` | 111 | `0ad7ca49eca5886d4916813a5dd8608daa884f0e178a49b2bc275e48e6cc78b7` |
| `tables/weapon_groups/Assets/WeaponGroups/K-G2` | 101 | `a84befcaedf76a32ea8affcdffa629a798ea79653e2ce3aedcb9b88a4fd74eab` |
| `tables/weapon_groups/Assets/WeaponGroups/K-G2C` | 98 | `6e8409045673ba74c59a0a38fbe8d80ac08c64f77f688213811bdb336dfcf061` |
| `tables/weapon_groups/Assets/WeaponGroups/L-BCF+` | 148 | `d3fa717167a5dcb73b7ec183ea50b5ed55586e5f1a811a3cbedf2fc8e2dbb10f` |
| `tables/weapon_groups/Assets/WeaponGroups/L-BCPP` | 132 | `c03c0f735a32bae0f8c48b1131336e43d5f47b931d58056c96fc3657eaeeb9a6` |
| `tables/weapon_groups/Assets/WeaponGroups/L-CWLF` | 130 | `5152e3bb033bac06796b0f227b96938d07769172eb2fd23fb92bd0f7d0ef6828` |
| `tables/weapon_groups/Assets/WeaponGroups/L-DW` | 130 | `2ba2de7859ca6bbe2b83a2e2185156c159da485ab21bde861a1c0b9ddaea330e` |
| `tables/weapon_groups/Assets/WeaponGroups/L-INT` | 108 | `3e6991132f7dbc3d33172b151dfb2cbf1c1302dc95040313622c07994793e8f2` |
| `tables/weapon_groups/Assets/WeaponGroups/L-PF+` | 114 | `c8ea96f354191a4a84e43d214b3438f89d2618dc2124be1c9d2f016d628adba4` |
| `tables/weapon_groups/Assets/WeaponGroups/L-PFE` | 120 | `6f7afe78a761dc364ca0a07f4acfc26b73c7c9f253681973ec3739ad840deb1c` |
| `tables/weapon_groups/Assets/WeaponGroups/M-AMM` | 94 | `ce361e59cf841b956858da57f8421b4ee899c526bce8481d00d067bb9bdc276b` |
| `tables/weapon_groups/Assets/WeaponGroups/M-SGL` | 134 | `6892b1013e2a53b191cdc63df0cdc6060d2bf8b4144f1b950ac80249024638fb` |
| `tables/weapon_groups/Assets/WeaponGroups/M-SSS` | 76 | `c165486b8b61c25041555385df7c9986e99d45d2f246cec4468e0a39ddad6499` |
| `tables/weapon_groups/Assets/WeaponGroups/N-ABPh` | 86 | `128128a550bdb7cc7cd235105de0b96e7e9324d5c582833aa55720dbb18bd441` |
| `tables/weapon_groups/Assets/WeaponGroups/N-ORG` | 70 | `34bf5f1198c84bc73b6badeced8078c499289e7de65a454c2d65e75ee8e434d4` |
| `tables/weapon_groups/Assets/WeaponGroups/O-BR` | 112 | `69ddd198d31a620d3fad627cb18b7355f05e3e727102ab6bf534ad97f9b5ca14` |
| `tables/weapon_groups/Assets/WeaponGroups/O-BRC` | 94 | `b2f0a0aff3e67bb77841ac39847201feb9acf393996ef970bc217d28397d7e5f` |
| `tables/weapon_groups/Assets/WeaponGroups/O-BRH` | 112 | `51f291397304724ddb324372bc3ed615208333b485436bb4365d69c494b7ef1d` |
| `tables/weapon_groups/Assets/WeaponGroups/O-CA+` | 118 | `fa1ef90509bfba2002aa3535f73200ae81fc7fe0e5bd9140279b511afe107cdd` |
| `tables/weapon_groups/Assets/WeaponGroups/O-CR` | 120 | `556c89bc76d6179aae1bdb0d030e87c3be13c35c6ff020000e4dad82e8411cd5` |
| `tables/weapon_groups/Assets/WeaponGroups/O-CVA` | 142 | `82ef2a0099f2f1503d5b027280be509c9c52238e0f96a4f13108900c4b8278d9` |
| `tables/weapon_groups/Assets/WeaponGroups/O-DBR` | 108 | `1035c13673b90d3c2e58da4cd01d714903249fac4e665270e338ee996a5730ae` |
| `tables/weapon_groups/Assets/WeaponGroups/O-DCR` | 112 | `bd0ca05bd672f0020d736dc3b247d7c889dc09985a5d8595f11a59c0b153e1bd` |
| `tables/weapon_groups/Assets/WeaponGroups/O-DN` | 118 | `6a3695de95e35088eb174a718f84e1689c2ce3a54466ec89dd48d3fd1b6f3d1e` |
| `tables/weapon_groups/Assets/WeaponGroups/O-DWS` | 120 | `677a52f1cb20ce74a7c0ac0ff6e49a5ab038c7c8b296b718d0dedfe5211e0573` |
| `tables/weapon_groups/Assets/WeaponGroups/O-HR` | 112 | `bd0ca05bd672f0020d736dc3b247d7c889dc09985a5d8595f11a59c0b153e1bd` |
| `tables/weapon_groups/Assets/WeaponGroups/O-LR` | 96 | `6fa45b889d9cda6637d1db9c6683c1daa3c09712a0ae27785759f2675c2bbbc9` |
| `tables/weapon_groups/Assets/WeaponGroups/O-LR+` | 92 | `29736fcbf7231c8d43ffc0b1ddfbd5e3c9862fe226f80623766829af3b55c089` |
| `tables/weapon_groups/Assets/WeaponGroups/O-LRS` | 80 | `142f1e3065b21c0ea034b6fcb25fc77fd6833f80df85ebd5c811ee5825dc7497` |
| `tables/weapon_groups/Assets/WeaponGroups/O-LRS+` | 80 | `142f1e3065b21c0ea034b6fcb25fc77fd6833f80df85ebd5c811ee5825dc7497` |
| `tables/weapon_groups/Assets/WeaponGroups/O-PM` | 126 | `5a65a2feefb353192c8817371126cba180284b5ca8c0a83e8df69bd4fe792b54` |
| `tables/weapon_groups/Assets/WeaponGroups/O-PR` | 88 | `e2b06a6c0fa7e41888a92ec789ead462d04afbef7d404d418ca08b56c7ad7144` |
| `tables/weapon_groups/Assets/WeaponGroups/PL1` | 70 | `34bf5f1198c84bc73b6badeced8078c499289e7de65a454c2d65e75ee8e434d4` |
| `tables/weapon_groups/Assets/WeaponGroups/PL10` | 70 | `34bf5f1198c84bc73b6badeced8078c499289e7de65a454c2d65e75ee8e434d4` |
| `tables/weapon_groups/Assets/WeaponGroups/PL11` | 70 | `34bf5f1198c84bc73b6badeced8078c499289e7de65a454c2d65e75ee8e434d4` |
| `tables/weapon_groups/Assets/WeaponGroups/R-BH` | 90 | `34438c2407ca427ca3f94cd1d36f3e0734cd4f152cc9e0f7d53c351f8e2a413a` |
| `tables/weapon_groups/Assets/WeaponGroups/R-FHK` | 142 | `0fe289661c0f01bdaf7745bd6a34c938c61a750b399fc24f9cd5af39f579c0b0` |
| `tables/weapon_groups/Assets/WeaponGroups/R-FLPL` | 114 | `1d2931fcb3a20ec202dfe236a362ef0f4516e249230ef58c992303fcbdcf2c96` |
| `tables/weapon_groups/Assets/WeaponGroups/R-K5R` | 98 | `67fa49776e70382a1dc49e404b6aeeb99c3e6f7c6c6c117d6ec9ac8516b28b04` |
| `tables/weapon_groups/Assets/WeaponGroups/R-KDR` | 122 | `4be09234dd6573832d8b21795fc00cd4885576b3c7cdc830a8a4ac0397dcf0bd` |
| `tables/weapon_groups/Assets/WeaponGroups/R-KR` | 102 | `723d368ce7416fdb10ef55302591f1ef5acaf3bde7e2735854ac582a8b30d22a` |
| `tables/weapon_groups/Assets/WeaponGroups/R-RGK` | 136 | `c48341c6fd30e4f3c404f174eec5afb0cd6942f4409d2dc08b6f0fc31fe7e131` |
| `tables/weapon_groups/Assets/WeaponGroups/R-SNA` | 84 | `07bf5edea5a57184d809cb28435861cd2d5c353519bbaaae577d0a879ba7e51f` |
| `tables/weapon_groups/Assets/WeaponGroups/R-SNB` | 106 | `1efb78679ec9ae416655fd2380116608e4932867ef7f3a9f3d0b5a1b444a2da2` |
| `tables/weapon_groups/Assets/WeaponGroups/R-SNP` | 92 | `4e2d51776fe567b84dc3b8f11e295c9375eb720f0f3efc4853b461a5a9497b01` |
| `tables/weapon_groups/Assets/WeaponGroups/R-SPC+` | 128 | `b33a5a4a9e3cf154d109c8ee6ffae7b4d6faffcbe55914ec1f0fb52390713dae` |
| `tables/weapon_groups/Assets/WeaponGroups/Z-BC+` | 138 | `697712a54ac5a9666d316827c26c5d13c3e6dc9f459a2753d942a3c11e6ff023` |
| `tables/weapon_groups/Assets/WeaponGroups/Z-CL` | 118 | `46ed4738accc87c59b16eb309e958d503a6800b70667de487b582fedf325a2f9` |
| `tables/weapon_groups/Assets/WeaponGroups/Z-DW` | 123 | `f9f855ee8b79f25e6566a0c7092dc320e1619306876248bb6d5e972294a4510a` |
| `tables/weapon_groups/Assets/WeaponGroups/Z-FFK+` | 100 | `8c8316baf9c367b04dd49a2b2b8ea87c622943b9697d461557b2a4f933bf4393` |
| `tables/weapon_groups/Assets/WeaponGroups/Z-MDC` | 115 | `2b8798006f231908d29ee22362b27b75a69c467881c99f0966812c8710efabe9` |
| `tables/weapon_groups/Assets/WeaponGroups/Z-NCA` | 131 | `9341467ee7bbf9add8f8d83a3778e0f1b773a4d65c50e9fea41e2e0f58367fd8` |
| `tables/weapon_groups/Assets/WeaponGroups/Z-POL` | 112 | `3ffd3a9aded7432afa38c601cfc62a5518b0cf79debcb14d94e271be76d50b4b` |

### fonts

57 path(s).

| Path | Size | sha256 |
| --- | ---: | --- |
| `fonts/bitmap/assets/fonts/bcascii10.fnt` | 22048 | `26fda2609f23ac8c4eb6ecd7f1ed34d33d0fc692d25b0b7f8ed4272ad269aae7` |
| `fonts/bitmap/assets/fonts/bcascii10b.fnt` | 22048 | `d67eb618b9d2933e793e6f83cad06b1171f0956809ee9c46059c4f7be256f323` |
| `fonts/bitmap/assets/fonts/bcascii10bi.fnt` | 22048 | `68800aec256b07fa4e449d6f798cd378de2f0769a7085dd32367bd1958ad5e29` |
| `fonts/bitmap/assets/fonts/bcascii10i.fnt` | 22048 | `fa5875f419ca68727385280b713079eb606666587aa0125508b35e48cadac1b6` |
| `fonts/bitmap/assets/fonts/bcascii12.fnt` | 26144 | `4d470073047d15ec3e01958aa5c6a9438f30b4ad6c673c19827e32cf09999351` |
| `fonts/bitmap/assets/fonts/bcascii12b.fnt` | 26144 | `81bb3931371a57a85d6954b7631c4663a941dd7ad6be5119f8e857db3e824785` |
| `fonts/bitmap/assets/fonts/bcascii12bi.fnt` | 26144 | `adf5ca49c1b9161b5f07617dfb8a64569ccb44d84e565019c14c3aa3d6a525da` |
| `fonts/bitmap/assets/fonts/bcascii12i.fnt` | 26144 | `60640c1b930211eacf87c1b49ce8dc4f82bf53941c6990563dc98ed653297e28` |
| `fonts/bitmap/assets/fonts/bcascii14.fnt` | 30240 | `8d1571035269439e0552c932f13a24d6a3af790075310f02c8e407602d94e496` |
| `fonts/bitmap/assets/fonts/bcascii14b.fnt` | 30240 | `793b0ccb9e7cc52e3beb5ca8c68807ad82c175a5cd5f431064daa48883585b04` |
| `fonts/bitmap/assets/fonts/bcascii14bi.fnt` | 30240 | `2a99b64bf6c7e82182784c5b78230f2820f0c39f31aee001af4f0db11eeec4c8` |
| `fonts/bitmap/assets/fonts/bcascii14i.fnt` | 30240 | `dedc8d7ebeafd57ed49797724c6f190abce03383611174aaa1e44042edfcc20c` |
| `fonts/bitmap/assets/fonts/bcascii16.fnt` | 32288 | `3e059281e4ac0587fff5c6ea8396b281b20ef07fdca9ac0175c4263d814d077b` |
| `fonts/bitmap/assets/fonts/bcascii16b.fnt` | 32288 | `bae1cac617d900e73f103401b372a98ed16bcfbc11d2816cd722f323ba96cdb6` |
| `fonts/bitmap/assets/fonts/bcascii16bi.fnt` | 32288 | `32f2653c68f60305e981482f889192bc3ddf2d72649fbcc24bbdc2ffc2172182` |
| `fonts/bitmap/assets/fonts/bcascii16i.fnt` | 32288 | `f9b18b0d980cf4b904f6c0651e1006d914a067276c2f6def32513f5e03ccd388` |
| `fonts/bitmap/assets/fonts/bcascii18.fnt` | 36384 | `f7d99553c3c8ac33c50260f43e814ca9539bf0d260df4961f62938ba37660936` |
| `fonts/bitmap/assets/fonts/bcascii18b.fnt` | 36384 | `64d6ab9fb54b68a972c0da9af1c35fe057f3b33497fa7456f9c8971918f67026` |
| `fonts/bitmap/assets/fonts/bcascii18bi.fnt` | 36384 | `323d5bcae6615720983d9a721bd76da2074f54eab56176d59c362ad1048b6f0a` |
| `fonts/bitmap/assets/fonts/bcascii18i.fnt` | 36384 | `d37ac098d5a0d7830b92093b2c74b824e63fc4aa9e5f0fa95352c8c0f660f969` |
| `fonts/bitmap/assets/fonts/bcascii20.fnt` | 40480 | `20ecc0cc25f579965eaa3bf83397a66737e088e6718e7388626fb0d2f97e2afe` |
| `fonts/bitmap/assets/fonts/bcascii20b.fnt` | 40480 | `e0133ab1b5b83df8ae11b2b3cf1dbb75f36663adc1df96f066eb531521799ef7` |
| `fonts/bitmap/assets/fonts/bcascii20bi.fnt` | 40760 | `6196ce7f87d7a38d04be63b2a8ea092d5ac79a27163c17646cdb3232cb5e1aa1` |
| `fonts/bitmap/assets/fonts/bcascii20i.fnt` | 40480 | `b9aefa1c327e6730ea2757efd667caff37a4fd3497ad7fe9f0004e7c0405b454` |
| `fonts/bitmap/assets/fonts/bcascii22.fnt` | 42528 | `82363ea7c5ba0cb8ff8e453ffd2f1ff17fe549279919005624d178fc983e4ebb` |
| `fonts/bitmap/assets/fonts/bcascii22b.fnt` | 42528 | `8e058c8db73e2d9c78100e367008ae7c3eaaa27eb8921768d53d4e4b8674432d` |
| `fonts/bitmap/assets/fonts/bcascii22bi.fnt` | 43120 | `716b10210d6e0b81d2a98c1f721cae3dc53d4c96c80152fe09572add1f033fa1` |
| `fonts/bitmap/assets/fonts/bcascii22i.fnt` | 42972 | `6baab70464a0ae3050c0c3508200d2bd1aaa0ad4f9c39bfa0d63a3b9d5aa1e82` |
| `fonts/bitmap/assets/fonts/bcascii28.fnt` | 54944 | `1b6aad8cf7818925ee4453e22ce73287da900e40036b1f0d92e1a0b92aa0f77a` |
| `fonts/bitmap/assets/fonts/bcascii28b.fnt` | 54944 | `1d6de1bb928c0dd056fb62169f61dccd44ea3498aa4cf4838c826ebafc235074` |
| `fonts/bitmap/assets/fonts/bcascii28bi.fnt` | 64160 | `9852152d31d4e7aecd0d13191584a68226f27dc7afa6f9db6ed96683d519124d` |
| `fonts/bitmap/assets/fonts/bcascii28i.fnt` | 63008 | `57572376b02fcbb1fc4ead09a75a8b66c060015f4b9f6edf116c14d1c48f5ad0` |
| `fonts/bitmap/assets/fonts/bcascii8.fnt` | 20000 | `2bdafa93c1dad119c9e95bd8b207c6f6845f98223c1f06620da363abd233f2c3` |
| `fonts/bitmap/assets/fonts/bcascii8b.fnt` | 20000 | `26e3223072250db96f756d7106893a512be524e5d2ca00b0736f408a96fce6b9` |
| `fonts/bitmap/assets/fonts/bcascii8bi.fnt` | 20000 | `58f45b4ccf1d235575ae552214b394d177e43bd7da78409be0cf0f8d48375637` |
| `fonts/bitmap/assets/fonts/bcascii8i.fnt` | 20000 | `6a0bc49fcca06385fd4bf44e3316bd7a31201e2c75e669f607f3f5cfd79a4440` |
| `fonts/bitmap/assets/fonts/bcascii9.fnt` | 21024 | `b2b742055bd22bcf20e593c4078c1a6c1b2b9865283b83653fdeac3c7f4cd8aa` |
| `fonts/bitmap/assets/fonts/bcascii9b.fnt` | 21024 | `21178714b0c2bcfadc8754e53591ff9e76e89d262f65aaa8ad697e1da7ad8e7b` |
| `fonts/bitmap/assets/fonts/bcascii9bi.fnt` | 21024 | `a4aabc8a60748ed00fd80c88f6de5389a51e830063e0902d2922149b80b275bd` |
| `fonts/bitmap/assets/fonts/bcascii9i.fnt` | 21024 | `f7eda99e0da949a92640eb4614500154b9c69e24e6c40d75e1f2ef203b4d0fa6` |
| `fonts/bitmap/assets/fonts/cnascii10.fnt` | 21024 | `d71606c8a824c2c9a4e09f0e9b4070fe0a3ad3ee1836906fa110cfb8e592f741` |
| `fonts/bitmap/assets/fonts/cnascii10b.fnt` | 21024 | `3d1601b52124fff15ad0350ff655f61dd9bb9ff0d5b36fb6669accac82cc3eb5` |
| `fonts/bitmap/assets/fonts/cnascii12.fnt` | 23072 | `7972bfa22edf9fabe03666949ea87acf4b85eae06978b2b7e00aed4eba2bdb36` |
| `fonts/bitmap/assets/fonts/cnascii14.fnt` | 26144 | `7d3b2581228211339ce40a91617f1f87025be0826a17d2de1018e35d58ee5794` |
| `fonts/bitmap/assets/fonts/cnascii8.fnt` | 18976 | `82d57a8f9c95746b7a5c93344aff19629b72f6957402da83aa6d15a211da2ec0` |
| `fonts/bitmap/assets/fonts/cnascii8b.fnt` | 18976 | `ee089d9eba8bd5d726e13580f8f431d035081a7da114bdaac44a0eb3d47f55a0` |
| `fonts/bitmap/assets/fonts/cnascii9.fnt` | 20000 | `be9e7464d816f22db5a038f9d7c7234a7101c9d080a35387d2f96d36411964d1` |
| `fonts/bitmap/assets/fonts/cnascii9b.fnt` | 21024 | `bbfa28273e67182d9b921681044be267621769ddaeb02db25f5e86f754418017` |
| `fonts/bitmap/assets/fonts/ocra10.fnt` | 17984 | `ac4aada46739d4532331d4b217408322e97597875efefae436bd73b4086f8591` |
| `fonts/bitmap/assets/fonts/ocra11.fnt` | 22080 | `af29549524e9556b6aa066d2d3b6e1b25e52b3d4ce2491521416080fb7369919` |
| `fonts/bitmap/assets/fonts/ocra12.fnt` | 22080 | `ccf409d0da37449cbe55587bdbe84f2a853698f01a1e83549d5fa2b028aa9963` |
| `fonts/bitmap/assets/fonts/ocra6.fnt` | 13888 | `121978e674f86b8106516c956ea3af0ed51f4ea307dd9d9e4b3cea1b67dfab6f` |
| `fonts/bitmap/assets/fonts/ocra7.fnt` | 15936 | `b85362c60c8433995ea85be81e283d04a7d761286dcab96c5dbb2555e2c75426` |
| `fonts/bitmap/assets/fonts/ocra8.fnt` | 16960 | `3ae0451d61531d1a0cf2cd1f0dbc41af47c9dd72948dfa83fe2c788f75af9713` |
| `fonts/bitmap/assets/fonts/ocra9.fnt` | 17984 | `43dbe2e5f7c406ea0b189f8693e667fd4dd313166d3f2a8c498a73343560525e` |
| `fonts/bitmap/assets/fonts/small6.fnt` | 14912 | `d16c392d70d4a35e51f71c499be22ba9ab02518d290ceb022a990264812ef3c5` |
| `fonts/bitmap/assets/fonts/TREK14.FNT` | 11072 | `a3cff1f746754c9c48d47a4b20fc9ab2dca28b5d44366736e470c7d589f51d14` |

### ftrlist

2 path(s).

| Path | Size | sha256 |
| --- | ---: | --- |
| `tables/Assets/specs/ftrlist.txt` | 9617 | `af4a661a5b0418857d2d42db975e41c8560d1eadd2f9b16f13331c1b1d706fe1` |
| `tables/MetaAssets/ftrlist.txt` | 9617 | `af4a661a5b0418857d2d42db975e41c8560d1eadd2f9b16f13331c1b1d706fe1` |

### gf

28 path(s).

| Path | Size | sha256 |
| --- | ---: | --- |
| `settings/Assets/CommonSettings/Chat.gf` | 660 | `c029a62307b09856ba0de32a3373e1014b7bd5e1e1053f624204805a16f445ca` |
| `settings/Assets/CommonSettings/german/RaceNames.gf` | 608 | `8c0976a8b24c04316b94ac8fbdf989989ed1ca6ad4493b370700506646fb2c67` |
| `settings/Assets/CommonSettings/RaceNames.gf` | 571 | `d2af0c114ca13bc1b62093a415e4fe1d694d701dcd18cbea58e8bcc505cd22c8` |
| `settings/Assets/CommonSettings/ShipNames.gf` | 6437 | `c06a7a790a5d02d0da544c803fccd04929f001925b4aa46e127ec71518e5d532` |
| `settings/ClientSettings.gf` | 44 | `94cd3e1a203857272c636d6fbeb0093ecfb2ce563d7d5380d8cac32d55b1b54c` |
| `settings/CommonSettings.gf` | 40 | `3aa128890911832cab7fdc96d268b65f847c525c77902e1daa9eb780f47460ef` |
| `settings/MetaAssets/ClientSettings/GameSpy.gf` | 44 | `aaaded1c991319c58b8f6e9cca5fdba0409351ec04043b90de34573b9ea9a6f3` |
| `settings/MetaAssets/ClientSettings/german/Help.gf` | 10642 | `2a763e4e1abed84d91ad945f69df4e3ae8a021ffb0a52e5309436ca84a24c53c` |
| `settings/MetaAssets/ClientSettings/Help.gf` | 9397 | `0342d9b4f266c575f969384a61ad6a29555f9b640a7d3317a290ce4676552829` |
| `settings/MetaAssets/ServerProfiles/Debug.gf` | 470 | `c88c5ddbc823c1a31ba27e04baa85c259881d622c2831ed81eff4faffc962165` |
| `settings/MetaAssets/ServerProfiles/Multiplayer/GameSpy.gf` | 188 | `02976321318c28150310b2834fbad87d13a2705c0022ead4a37825b61c2912fc` |
| `settings/MetaAssets/ServerProfiles/Multiplayer/WONServerSetup.gf` | 712 | `ad828fad20290bb53925884791498edf047a8f30467a35b10cd8e02a7539c8f3` |
| `settings/MetaAssets/ServerProfiles/Singleplayer/Assets.gf` | 263 | `cb35c156b0f0495f60598923d49ad86ad279747cebdccf6aac399b828a692003` |
| `settings/MetaAssets/ServerProfiles/Singleplayer/Character.gf` | 3052 | `9bed80e5d4f9aab61c9df469ab9d5ee5e81385a03fa8387c0183fad09ce54588` |
| `settings/MetaAssets/ServerProfiles/Singleplayer/Database.gf` | 273 | `b8c33bdcb93de79311d25f5e16cedb011e6e5568c1e36b4b74519f652c493d1d` |
| `settings/MetaAssets/ServerProfiles/Singleplayer/Economy.gf` | 2856 | `7cc6089c432caafab050482f687da0ea7943a7c408736fce7c8d94291b331cdd` |
| `settings/MetaAssets/ServerProfiles/Singleplayer/german/Language.gf` | 44 | `25b192502916f232727ec9375ef9d10c29fd711ef122e1dd492a1380d26585a6` |
| `settings/MetaAssets/ServerProfiles/Singleplayer/german/MetaMap.gf` | 6408 | `9d9e655ed79bb3626d3b3d12b6c6389592afa1bc6e43fad14ecad5d7ec417668` |
| `settings/MetaAssets/ServerProfiles/Singleplayer/HexValues.gf` | 493 | `fcd36ae64c0ecdc5a3b97c77a1f69500611847a9b4a970ed3a5883af36c8f17f` |
| `settings/MetaAssets/ServerProfiles/Singleplayer/Language.gf` | 44 | `2cce16acfe2d58120efd66c43f75f81519c1626934671826295b1313bbfb469c` |
| `settings/MetaAssets/ServerProfiles/Singleplayer/MetaMap.gf` | 6671 | `ff25cd0dd580e5c22353dcfc107f3eb1cf68d0001fecccce6d38fe3ae710c370` |
| `settings/MetaAssets/ServerProfiles/Singleplayer/MissionMatching.gf` | 4189 | `ab35eac9b54f31abc2906428e73127c38cd63dd7ecb1ef7af5b4165332941b64` |
| `settings/MetaAssets/ServerProfiles/Singleplayer/News.gf` | 1657 | `b607c5c7368001b314c4969ff60be448ddb6fa58a8bdb9b50cb2a1003a6afe5e` |
| `settings/MetaAssets/ServerProfiles/Singleplayer/Score.gf` | 2351 | `3907d8db60a8f910f2187659064cf326119b343013482ae1f7dafc9df67489b6` |
| `settings/MetaAssets/ServerProfiles/Singleplayer/Ship.gf` | 515 | `97980653eec5693a449b119e599277f0c10c076140dcec20ea09326e3713c7d2` |
| `settings/MetaAssets/ServerProfiles/Singleplayer/SinglePlayerServerSetup.gf` | 758 | `b7830948dab328c6848c62030367c66b495a082ca53882cd928d5fd8d64e050f` |
| `settings/MetaAssets/ServerProfiles/Singleplayer/Time.gf` | 248 | `aa479b007121cdbb0051bad1d74a7e373114d92bca51805f02756ceba625769f` |
| `settings/ServerSettings.gf` | 58 | `28c44f67614663b63740749ed07ac99413c879ad763c07ed1e06668f88ac284d` |

### mct

28 path(s).

| Path | Size | sha256 |
| --- | ---: | --- |
| `scripts/Assets/Scripts/Campaigns/ConquestBonus/Conquest Fed .mct` | 814 | `105cdb53f8c8d9dc1624efa4447b29bfc60dd91297603d8c2dad25d1e9fa0396` |
| `scripts/Assets/Scripts/Campaigns/ConquestBonus/Conquest Gorn .mct` | 814 | `5faa76544c366a59a858f8f5965f061b4f0ad28bdf99f7370ed5e70579ec5a0a` |
| `scripts/Assets/Scripts/Campaigns/ConquestBonus/Conquest Hydran .mct` | 816 | `0af79229f059bac526c06b1912be7d6c2d211200fde03187b197e551e007faca` |
| `scripts/Assets/Scripts/Campaigns/ConquestBonus/Conquest ISC .mct` | 813 | `9364bddd79f6e73a25c26fc18c6e3e68f96a5af0f39247bd5f893b40ba69f002` |
| `scripts/Assets/Scripts/Campaigns/ConquestBonus/Conquest Klingon .mct` | 817 | `c3a39186e97a5aba738a6841139cf88ab6cd3ff88fdcccfdb9935cbd97148ed1` |
| `scripts/Assets/Scripts/Campaigns/ConquestBonus/Conquest Lyran .mct` | 815 | `29edce004de04c8e19f78ee2354b2818a59fc3c1f9374ebcf1795b8ac6ae1dc0` |
| `scripts/Assets/Scripts/Campaigns/ConquestBonus/Conquest Mirak .mct` | 815 | `8f054406207baf231d7a07d3dc11b206e44c320bcb8217cdda10e06c32f8c969` |
| `scripts/Assets/Scripts/Campaigns/ConquestBonus/Conquest Rom .mct` | 817 | `a8a0fe5ad926001bc8486821f9abfef3740261fa74f0b250fe54dc8c753e728b` |
| `scripts/Assets/Scripts/Campaigns/custommissions/Custom-Federation.mct` | 826 | `471a0685903af6cdf6d60430e76bfb197da63fc273b330db840c2986fee72322` |
| `scripts/Assets/Scripts/Campaigns/custommissions/Custom-Gorn.mct` | 819 | `76dd39eef1b5a7b917c554e21c7c5c2f7712a4d58944a34ecd96c5ef2964f0ec` |
| `scripts/Assets/Scripts/Campaigns/custommissions/Custom-Hydran.mct` | 825 | `9046dcaa2f8c9a6d56c9ecc7944d943fd5a83a921a6ab7e9b9bc90aa58b656bb` |
| `scripts/Assets/Scripts/Campaigns/custommissions/Custom-ISC.mct` | 814 | `50b9c1cd70c41b5c08cfacc298411b132212c727c04642c71ba23eaa53689dcb` |
| `scripts/Assets/Scripts/Campaigns/custommissions/Custom-Klingon.mct` | 835 | `21ab0b548fab3ca176983b5eaf05e426de7207a82b7cc811834de9c767fd4c5e` |
| `scripts/Assets/Scripts/Campaigns/custommissions/Custom-Lyran.mct` | 824 | `4b0914688bb19294ed9260ce03e8542be800834963a674166ee5d5280b58e03d` |
| `scripts/Assets/Scripts/Campaigns/custommissions/Custom-Mirak.mct` | 821 | `4b3fee67b710a39665d4520050c1e8a56fef6fc9521759453abf1f55afda0a06` |
| `scripts/Assets/Scripts/Campaigns/custommissions/Custom-Romulan.mct` | 837 | `0f4731bd5a029faff59d1aee717927bae7f87df00e3187c2eb1952b215135af3` |
| `scripts/Assets/Scripts/Campaigns/ISC-Fed.mct` | 1366 | `1d0a51458b9b72a67fa2d2a2ccd76391206f4a24e9350c67cf3a8efdbdcf7102` |
| `scripts/Assets/Scripts/Campaigns/ISC-Gorn.mct` | 1379 | `26a395db2871900d87ff404c2832d71b81c5a395cab1a3b69a88350b22567efc` |
| `scripts/Assets/Scripts/Campaigns/ISC-Hydran.mct` | 1288 | `66ce18e24b91ed8f31378bdf3f25b939ac7b78faff0bb7ae09fb08318edd4b09` |
| `scripts/Assets/Scripts/Campaigns/ISC-ISC.mct` | 1228 | `87df7f135351caa8998f40b90b36787355447f8ea03e949f89db11480bbcc8d1` |
| `scripts/Assets/Scripts/Campaigns/ISC-Klingon.mct` | 1274 | `17b7085cd0511b8acd2a3e5da7a0f6174a8731b62a4bc2d86aaf65b162e3f895` |
| `scripts/Assets/Scripts/Campaigns/ISC-Lyran.mct` | 1306 | `420aa3ef30c19b221fbd9706e6fbe9a3415eb5c0f059c5e6f732163c483a54d4` |
| `scripts/Assets/Scripts/Campaigns/ISC-Mirak.mct` | 1305 | `5003972b1c11c70cbbd8181cd3238d22e8fca30e03e79331d5c2aaadaa2f7f89` |
| `scripts/Assets/Scripts/Campaigns/ISC-Romulan.mct` | 1347 | `9c9bee9d97488022259926f799f1b46d0a65ab420b443735dd36566747be4953` |
| `scripts/Assets/Scripts/Campaigns/Mirak - Hydran.mct` | 1192 | `bde8757c3224bd11e73d0934593eae2901f7186af820c9c272c4ffd56c967441` |
| `scripts/Assets/Scripts/Campaigns/Mirak - Klingon.mct` | 1194 | `5393ca6ef8f72e37601ff9c7e6059e819a8bdef3edbfee8bb6a5f15948347014` |
| `scripts/Assets/Scripts/Campaigns/Mirak - Lyran.mct` | 1173 | `9004007a5136e50988f81b82241a8e16b1297802c38ea97f0b2b5a33514f8823` |
| `scripts/Assets/Scripts/Campaigns/Mirak - Mirak.mct` | 1162 | `88616ba9aa1126c4176e0f325f5d8220f64bbf107ae6a13120c5524049c1a1d2` |

### mission-modules

127 path(s).

| Path | Size | sha256 |
| --- | ---: | --- |
| `scripts/Assets/Scripts/Bon_1Sulu.scr` | 385536 | `5ece366b872b36d638d9a29ee4968a56ffad22a344aaa6ab221041208d9ce5d0` |
| `scripts/Assets/Scripts/Bon_2Sulu.scr` | 368640 | `11a642454101668db214ea9595bdd8efc11be72058af7bd6ede6a3fc0cefecde` |
| `scripts/Assets/Scripts/Bon_3Sulu.scr` | 374272 | `54c23703d8dfcb413b27ddf02cbabca9f5833b7133255d7e081146aee46d8a5d` |
| `scripts/Assets/Scripts/Bon_4Sulu.scr` | 376320 | `9810f172f6cc2d41fdc4824630c10dc7372eb1e838b092fc9d4e3f0d0c1072ac` |
| `scripts/Assets/Scripts/ISC_10Criminals.scr` | 373248 | `4e2416425d51d65efd54d4afbed92586229e00799c8dd041a5c50b16d67dcdf3` |
| `scripts/Assets/Scripts/ISC_1Peace.scr` | 379392 | `45ab48397fef0ef8ac557252719b154848d1a454faae647fed3cd99eb93d3be9` |
| `scripts/Assets/Scripts/ISC_2Promises.scr` | 370688 | `bd5cf7da64c9ad68e2ed4b99dacf1fc2ddd5953f85ad0732f1f71b30c64788c9` |
| `scripts/Assets/Scripts/ISC_3IronCage.scr` | 389120 | `4611a2ca777b70e7a0e11d79810724bbda568cf689ff274915a8be5c25f715dd` |
| `scripts/Assets/Scripts/ISC_4Resolve.scr` | 375808 | `522c7c6d0be5330adf500eb7599316991ecd3ed5cf84b2c6bc2b10412b83fed1` |
| `scripts/Assets/Scripts/ISC_5Accuse.scr` | 407040 | `dd5a5e3109962ac79d4c29ba9992c2d4d3641e3ab0c404c71a53df88c8fd7f77` |
| `scripts/Assets/Scripts/ISC_6Immunity.scr` | 375808 | `8dadc85d30bd6bb556c9666489ab41de1a94d4866be6e5903a2fbaf75acecf1f` |
| `scripts/Assets/Scripts/ISC_7BattleGrave.scr` | 387072 | `13cff267e1cba64c656d569d12d2236f3a13d03893efef29753dd42d0a8a62e9` |
| `scripts/Assets/Scripts/ISC_8Diplomacy.scr` | 394752 | `2686d04102dbab4a73488fa92df79518abb2c85b116acc8dbc494a4dbd25ee2e` |
| `scripts/Assets/Scripts/ISC_9B1Homeworld.scr` | 405504 | `5d850462bc235dc0887186d08717826f099d1227beda19f0d3494a12e22b717b` |
| `scripts/Assets/Scripts/ISC_9B2Homeworld.scr` | 405504 | `49201dc87872147728d9c50acb9d0587a7c18656d921d05f51f2d99a78fe3e87` |
| `scripts/Assets/Scripts/ISC_9B4Homeworld.scr` | 405504 | `1516e7ff61a1552546936001c455a8c90cbc1f761354d5d21719d43338e17e22` |
| `scripts/Assets/Scripts/ISC_X3M1BTemple.scr` | 384000 | `a0fbcd6807063eca040083652cdffa48497423e909b12513f664f97a58080fb1` |
| `scripts/Assets/Scripts/ISC_X4M1BThief.scr` | 375808 | `39e9cebea12c9cefed6da2955682fe89418c9e2b1225338159416819c508cd71` |
| `scripts/Assets/Scripts/ISC_X4M2BBomber.scr` | 378368 | `6e04a03e58a92a8488f06c23645e5328b7c45dbdc749c1c80c100f2203aead76` |
| `scripts/Assets/Scripts/ISC_X4M3BFoxtrot.scr` | 393216 | `43be4737f228731b40d350e51d731369e58ac671a371e9653d7b46fef519dec9` |
| `scripts/Assets/Scripts/Met_10BasePlacement.scr` | 554496 | `b6af685b7a8d26edb2db19f19ecf65bc67b15e62865958336ad35638d25410ae` |
| `scripts/Assets/Scripts/Met_10Patrol.scr` | 391168 | `6463414505c5a5116c72987f6b9b03888611d984a2724b39e4d00a0774c7c341` |
| `scripts/Assets/Scripts/Met_11ConvoyRaid.scr` | 378368 | `9e31cfd1b28d03522da35fb4d010a1edb56fa28b0d0c05ce251888e41441a1c3` |
| `scripts/Assets/Scripts/Met_12ConvoyEscort.scr` | 380928 | `1130978aed22eccb1ec66d25a3d7c6ab04d053ee61273e49573b669e509e56f8` |
| `scripts/Assets/Scripts/Met_13Monster.scr` | 370688 | `97fb7423a80df9e90c0b31d147690aecb7dd5c0f88f6c5a225638dadea0e8702` |
| `scripts/Assets/Scripts/Met_14Enigma.scr` | 372736 | `5713f6ec8217c0cd18a751deedf892cdd1cd3ec4ea8a948e1913b110dc4085b7` |
| `scripts/Assets/Scripts/Met_15BaseDefense.scr` | 375296 | `41166c3885e485f5898604595d96cec3d2598eeb2bf239093164119773ff70c9` |
| `scripts/Assets/Scripts/Met_16ShipDefense.scr` | 376320 | `77354b57c2a1becc368c142e0e3d63a42b74fd2a1b418f4f09bc5e7eeb16f8a6` |
| `scripts/Assets/Scripts/Met_17Patrol.scr` | 389120 | `2d73988be53c290abb1520a745e587380244f25e5f3884f1ae57c087841a811b` |
| `scripts/Assets/Scripts/Met_18HomeworldAssault.scr` | 374784 | `b3f27a8435579a24b3a854da0a2ae0f7766ec9defbcb6af28817ea99cb81163c` |
| `scripts/Assets/Scripts/Met_19Scan.scr` | 391680 | `c5e266d6c60cb064014c8a8679e34ad82d6a817e4ba9ae148e5cf425ae669904` |
| `scripts/Assets/Scripts/Met_1Scout.scr` | 367104 | `161fa492e111918afb9965a4228998ca9b9c1f4f3693bffccf861117983ac667` |
| `scripts/Assets/Scripts/Met_2HoldingAction.scr` | 375296 | `3e36280e574f32782af06cbf10653b99b14df6e1ece5c366bfbcf7b1345f7a06` |
| `scripts/Assets/Scripts/Met_3Ambushee.scr` | 377856 | `00c4e0b7557a4073753067de12e33cf6fdb10496c0f9c75512cd6c33cec92b26` |
| `scripts/Assets/Scripts/Met_4Ambusher.scr` | 367104 | `da72ee91d27c46eaf67bb74a517fd3ac7e878b4f0950dd215e2396ff3b1d3e1c` |
| `scripts/Assets/Scripts/Met_5FleetAction.scr` | 363520 | `9ce025a3856a3a4bb320584c258612925f99033f14aa95a956e8132ccc8ff2f8` |
| `scripts/Assets/Scripts/Met_6Patrol.scr` | 391168 | `eafef0fb3a9b3b2534820df03faec200e4d96f364c3c177ee3424f1cd070a103` |
| `scripts/Assets/Scripts/Met_7BaseAssault.scr` | 374784 | `28518212beee070faa1103c2502a55ded86b1a3a2a42f2898011c643aa99ea2e` |
| `scripts/Assets/Scripts/Met_8ShipAssault.scr` | 375808 | `c4634e37046ae7285a1a41d3c7507efc79021bd425fb221cc984a5793b2538e9` |
| `scripts/Assets/Scripts/Met_9PlanetaryAssault.scr` | 375296 | `7ed6d43f9836a36a2623fc9bae29e49feb9a3b1e35684a5668ac7b0d82114353` |
| `scripts/Assets/Scripts/Met_ED10Monster.scr` | 561664 | `eac43ea92521a3c9a6334ba6b89ad2ddec0b62008d9bca7659b984d608ecec1b` |
| `scripts/Assets/Scripts/Met_ED10Patrol.scr` | 566784 | `16dfb17b358b55436d803b8a24d8515c09e0d9eb1d1887763dc69411e7e37e65` |
| `scripts/Assets/Scripts/Met_ED10PatrolEnemy.scr` | 566784 | `152d65433f11aaad531510903d556c7c1cea7d7a2020610a046f155376aea8a1` |
| `scripts/Assets/Scripts/Met_ED17Patrol.scr` | 560128 | `862ccbda80df3d4f3e8c2774a287af0e30af7513fb6af17e0f889db8b188be54` |
| `scripts/Assets/Scripts/Met_ED17PatrolEnemy.scr` | 567808 | `b67cc3a13169c8366e808ccbdfb991c1c91508b67d0017bd0562d6274964247c` |
| `scripts/Assets/Scripts/Met_ED5FleetAction.scr` | 542720 | `aa8bf4ed68e2ecb8c8f1077753fbf81fc4f6ada03002f2e65bedb6ec8c2a5417` |
| `scripts/Assets/Scripts/Met_ED5PlayerFleet.scr` | 543744 | `b9bd129972c09e417e45118b409e23c17ca509d62039bddcf35fbc786938a0f7` |
| `scripts/Assets/Scripts/Met_ED6Patrol.scr` | 564736 | `0bd83d2336c425f5b0ab09661b2f9e7dbc9cfcaf95de9167883b1be1714836c7` |
| `scripts/Assets/Scripts/Met_NW11ConvoyRaid.scr` | 375296 | `d8774bfd4b9223d51166f8dfdfd45504e726047f278923a346e593a38e2cf925` |
| `scripts/Assets/Scripts/Met_NW12ConvoyEscort.scr` | 375296 | `74155e607e06461d2866f8ad12b46e1b41184c044c8515d8e4658df8658abb1e` |
| `scripts/Assets/Scripts/Met_NW14Enigma.scr` | 374272 | `b00ed34f7ecba094e3809f0c0c26352120b9319dab59e2dfe14fa324086a9a7c` |
| `scripts/Assets/Scripts/Met_NW18HomeworldAssault.scr` | 377344 | `5e26f39f9ed939b3ccb98d9994a9a9967d948e83a8465751c9e87ce2bca4cd50` |
| `scripts/Assets/Scripts/Met_NW19Scan.scr` | 393728 | `3748ed45a97219a70f5dfea2e4faaf9738b3c11d3806f8704ecf69d9a0d440d5` |
| `scripts/Assets/Scripts/Met_NW2HoldingAction.scr` | 377344 | `d2cdcd186e2600477b0f8e11e937239b5f469a16148dcee2bda318c37fcf28d3` |
| `scripts/Assets/Scripts/Met_NW7BaseStationAssault.scr` | 380416 | `d70bddda5de2a5fc7d5262fcfbc9a015118e0dee5f0ed592a935f0a7779fe708` |
| `scripts/Assets/Scripts/Met_NW7BattleStationAssault.scr` | 380416 | `4ad81c27b0bcf3b00a7aa72ba345473070ce877f5ac94335c844e7019e373c90` |
| `scripts/Assets/Scripts/Met_NW9PlanetaryAssault.scr` | 377856 | `fc398f371ad2e7bd6539be848e07599da16a15c9f384e562390b37fb69c49bd8` |
| `scripts/Assets/Scripts/Met_NW9TimedAssault.scr` | 442368 | `029135c6690d5654dcd4be3946fa19d49f4dd8721c83324b7186f482c2beba40` |
| `scripts/Assets/Scripts/Mir_10Search.scr` | 372736 | `23ba111e7710b7920b31ca3268d6343814910a06ca580142f4f06ae04ba14930` |
| `scripts/Assets/Scripts/Mir_11Wedding.scr` | 381440 | `4617a52a58a68c47912d2e5ad450ddbd054b95961f7f6074837c21a2ff1f8765` |
| `scripts/Assets/Scripts/Mir_1Desecration.scr` | 365056 | `b542dd502d4b03f8784a6c18af031ccec0c2f51c52cf7f58e2cdf911d3d36620` |
| `scripts/Assets/Scripts/Mir_2Dance.scr` | 390656 | `62878bcd5510e26e86f917ca0075ff478879f96b9c5a4968a3d2b50ad926d1ed` |
| `scripts/Assets/Scripts/Mir_3Tug.scr` | 377344 | `3e73407594f43e5aee52415f6abdb793ed90d74b1b48ed380259354a498dfe29` |
| `scripts/Assets/Scripts/Mir_4Playtime.scr` | 376832 | `c8e902f71538d80ea28002a2dbf5a3b5fc5e5e38cae11a23f06e494bb2089d2c` |
| `scripts/Assets/Scripts/Mir_5AFunny1.scr` | 373248 | `1f5b1940c0b1b50c6eb5639ca54ff3865716c17bf3a5a022b3700dae74ada8f9` |
| `scripts/Assets/Scripts/Mir_5BFunny2.scr` | 384512 | `e0c0428fde452d9ac94b280163153569b9252cddf1d8b828a7abdbf7d8ecf8ec` |
| `scripts/Assets/Scripts/Mir_6Wheel.scr` | 385024 | `6179521d6338eae1bacd44824ab705d8403a9b40addd27a1fa0e6b5b9408eeef` |
| `scripts/Assets/Scripts/Mir_7Gates.scr` | 376832 | `b4eaa445b8aaf19091e207c17b9db04207d4588517b9f83e98fdbf8a24644d86` |
| `scripts/Assets/Scripts/Mir_8Massacre.scr` | 395776 | `009dfadf14e8f604b2fa5321a5f7a5640678481c7864a916bc274a88531ebb5a` |
| `scripts/Assets/Scripts/Mir_9Edge.scr` | 378880 | `3389dc61c82cf868124a38b5654750a7ce6f8f832626cf031aa894db7df702c3` |
| `scripts/Assets/Scripts/Mul_10Hockey.scr` | 381952 | `f2e1a45ad4296306697f05fded15e34e87d27a807a090c399c1be1129bb63de3` |
| `scripts/Assets/Scripts/Mul_11Tinyfest.scr` | 368128 | `2a2b7a35dcbc99f1754b69a5b8159b829b61191f421a5a76cf2499ef402db2e2` |
| `scripts/Assets/Scripts/Mul_12Slugfest.scr` | 368128 | `dc6f541ae9bb9d0d613e5ed17e7e30fb3622d6a76abfba5d2b9635bb79c94ec8` |
| `scripts/Assets/Scripts/Mul_13RandomBattle.scr` | 361472 | `b5b21434bf8176fea19556562d28dd23420233389c992a5cc1bd230d415d932a` |
| `scripts/Assets/Scripts/Mul_14TimedBattle.scr` | 365056 | `339e222ef3a1f9ea2abda1d8433a42be51d93411b45a124f7bfb42bb66ce4135` |
| `scripts/Assets/Scripts/Mul_1Free4All.scr` | 361472 | `370e04b2cd5d66d817e4fb59f0b90468b7d2fd39cd110e9d40cbf0d6b3aa312f` |
| `scripts/Assets/Scripts/Mul_2BaseAssault.scr` | 371712 | `7b77b2c9670ae5d3ee78bbef847fdf2e3850fb2625019edb98d0f7bfe9b58d92` |
| `scripts/Assets/Scripts/Mul_3Battlefest.scr` | 376832 | `e42c59885874975a3ca4c63561d6e34de5ea682a8f970ed2ba265c4a3a295ecc` |
| `scripts/Assets/Scripts/Mul_4Tourneyfest.scr` | 376832 | `baaec65a6c6b5e73ec77aac3b0e254e649198145d6b33c375e1e9e2512646438` |
| `scripts/Assets/Scripts/Mul_5BattlefestLite.scr` | 368128 | `b4e23eac19b52e462bab2c28704e620c67b6c6b6a8773fc4378fd365efccbb05` |
| `scripts/Assets/Scripts/Mul_6TourneyfestLite.scr` | 368128 | `07aac196a9d6fbe725a2facaf0d79fee2cf9a36b9ac40fd19b3437307a08cd6d` |
| `scripts/Assets/Scripts/Mul_7Tourney.scr` | 360448 | `fdc77bdf8b223a231adbf4ed5df00638844b4e69f5f34c56c9fc89d2b44bbd1e` |
| `scripts/Assets/Scripts/Mul_9TeamAssault.scr` | 370688 | `2940eafb1e48951bf16840753a4fc8d7c51cbcf0de4233f12fb8031d8a9d555e` |
| `scripts/Assets/Scripts/Ski_1Free4All.scr` | 360960 | `189be624edd9026de02c13cbfaf67f1326cdebfca32d4d2eddc54e76a3d37dff` |
| `scripts/Assets/Scripts/Tut_Command190.scr` | 350720 | `758d0bfee41f0e9d78d5ebb6646a1d8b4ce0a15157304be663a8eaa7e885557b` |
| `scripts/Assets/Scripts/Tut_Command290.scr` | 352768 | `2a721068db2e752fa8374b45fec739a78a8d869808b86502510f8519844102c4` |
| `scripts/Assets/Scripts/Tut_Command590.scr` | 366080 | `f634d7a585ddd690a3368d8a06d233d23530fa0372186682d3d9a6ab6f8993fa` |
| `scripts/Assets/Scripts/Tut_Science310.scr` | 366592 | `38e3e092112eaf518294444644e6cfeb7a7ce4cd7062ff890191660e28ef6cc8` |
| `scripts/Assets/Scripts/Tut_Weapons380.scr` | 363520 | `3f5b05e252abe9cbf273204942148bd502b3bcf3c35bc4247d93c87bfd1bd86f` |
| `scripts/Assets/Scripts/Tut_Weapons480.scr` | 360960 | `6b4b3fc5521f0f8c7e683b7e95fe63f39628eb12c32c13fc74dbb5dd6820b5c8` |
| `scripts/Assets/Scripts/Uni_10Criminals.scr` | 389632 | `77a6d3add871862e01eb381cacd2154e1074122d082fe179c7261ade5e056ebe` |
| `scripts/Assets/Scripts/Uni_10Search.scr` | 371712 | `1850a9b1b917b400a93eb675aee3e1d1c4782d86dfb6f6a99f1796931cfe1453` |
| `scripts/Assets/Scripts/Uni_11Wedding.scr` | 380928 | `7c1380c03cb517a4e493ee579420deeb0fe72deb21c4156a793e2ca797334d29` |
| `scripts/Assets/Scripts/Uni_1Desecration.scr` | 387584 | `d636e360d476bc1b80d52bc7e147bcf25884680b4e28a85aacab43c73827dd5d` |
| `scripts/Assets/Scripts/Uni_1Peace.scr` | 385536 | `f29620b97d99cb8af66b58f0f568cc6c6b499eab71141a5ae98f28a9d1bd61be` |
| `scripts/Assets/Scripts/Uni_2Dance.scr` | 390656 | `417b701093d8ff59f4a30c471182ddf7c1dfa5b430416f785f7694e1f85c9c9a` |
| `scripts/Assets/Scripts/Uni_2Promises.scr` | 400384 | `ced5b6f3bcaf90a0cabd6fd940b1e30e5484b2ca5672d2f97357e4a23f72c55c` |
| `scripts/Assets/Scripts/Uni_3IronCage.scr` | 389120 | `042f877bb2afc05da5a6814b6c2af2389926042f1172a25ff7aad255cd309015` |
| `scripts/Assets/Scripts/Uni_3Tug.scr` | 377344 | `855e0e2bbe23495f3ae4103faeed6af6dd26e6b3f379efd237964d5970dbdba7` |
| `scripts/Assets/Scripts/Uni_4Playtime.scr` | 376832 | `381f28fb4aad13e2211d6bbb0598ad916e4b8e8d76b3c1b506379edb691b54c7` |
| `scripts/Assets/Scripts/Uni_4Resolve.scr` | 388096 | `a684119b35a98775dcc546176cb9060b428cdfaaf77231ae19d8b4eeb7b37fd8` |
| `scripts/Assets/Scripts/Uni_5Accuse.scr` | 399360 | `667073e7d58f5dc2def2d80840330f0d3606dd446d29892c76545c7fe592bf48` |
| `scripts/Assets/Scripts/Uni_5AFunny1.scr` | 373760 | `463ef1b364be7b3270aa7ae9f4292fb9a807e6ac69c5c3571db3494dd24a0dca` |
| `scripts/Assets/Scripts/Uni_5BFunny2.scr` | 387584 | `6d2c05eafba1c9007601376f0c7fa260c71d1b4fb3ade99e998d6ff21183b193` |
| `scripts/Assets/Scripts/Uni_6Immunity.scr` | 400384 | `28cc0c9dd20c6d9ea4d4021146579c145921b1de1144d7e595e4163995fe5dcf` |
| `scripts/Assets/Scripts/Uni_6Wheel.scr` | 385536 | `5861d4229e58ac6367eddd011d841eb52770189925beb02e09e5179986bb5484` |
| `scripts/Assets/Scripts/Uni_7BattleGrave.scr` | 448512 | `a47acf42d36ea53c0bb65db6a971521dbe7685523829ec578918c5e8b8e16e97` |
| `scripts/Assets/Scripts/Uni_7Gates.scr` | 376320 | `63397522997f66bcb6403d012f9801377907a774f1542547a2229de0c81db6a0` |
| `scripts/Assets/Scripts/Uni_8Hammer.scr` | 395264 | `8aa849d0b8fe60c18f6690f513987392f4f1c7e604d6e2eb2d91198afa4ac119` |
| `scripts/Assets/Scripts/Uni_8Massacre.scr` | 391168 | `edf763bc5c0e7161e48d709db740f1bc05d5b1c69710a0e91926174513e428a0` |
| `scripts/Assets/Scripts/Uni_9A1Tyr.scr` | 410624 | `c32e8ebd98518aac589216ba49294a799f2d6fe73272d9b540bde9ba14bc0868` |
| `scripts/Assets/Scripts/Uni_9C1Welcome.scr` | 370688 | `a14bf6364bf54d3e102b10c2abc07fe73e0bb9ed0e18fe783c8e86b31fe7bc6c` |
| `scripts/Assets/Scripts/Uni_9Edge.scr` | 400384 | `05492faf9f812378cf58838c5d9052d7ec6ca3917343dd62427cb98fc932e88a` |
| `scripts/Assets/Scripts/Uni_X1M1ASmuggler.scr` | 387072 | `43f93534a43473bd9040a4cdda0db86670f5ffcf21aa942b441cdf9e14e3cf9b` |
| `scripts/Assets/Scripts/Uni_X1M1FInsurrection.scr` | 373248 | `28dd28db90036fa9340b4aebb092bb9f0e09cb6e29fcfe15a2fbe89d3e56a477` |
| `scripts/Assets/Scripts/Uni_X1M2Trial.scr` | 377344 | `fe5b1590dc07676f799e21ebfab5098acc5e4c0c598eab406070d1377df3d686` |
| `scripts/Assets/Scripts/Uni_X1M3Poison.scr` | 373760 | `a8ef48943d43c4480962e814cf350fd3defc5564a6da69bc5dfb3065df1e3acd` |
| `scripts/Assets/Scripts/Uni_X2M1Interceptor.scr` | 358400 | `15a9bdd42fe8d67becdf8e02a226a422c3c45c34810a669fc53f7cf70630a1b3` |
| `scripts/Assets/Scripts/Uni_X2M2Reclamation.scr` | 386560 | `fd7c020eab5ba9ca4143c9db12af25e143efda06eb3c0a599167dd515361e4d9` |
| `scripts/Assets/Scripts/Uni_X2M3Apes.scr` | 380928 | `5fc1891faa5fad13b5cc4cd5751807c8d3982662f55070ea3b6f07cdce3f2a87` |
| `scripts/Assets/Scripts/Uni_X3M1ATemple.scr` | 388096 | `760b295247b292156d9316f5b443d27212237c98417a0764b532afdf887bca76` |
| `scripts/Assets/Scripts/Uni_X4M1AThief.scr` | 386560 | `aee3738ccfec040706bf73cadf475a73911973061d559b92a7e4e4bf1a4bbd17` |
| `scripts/Assets/Scripts/Uni_X4M2ACuckoo.scr` | 394240 | `09e02a2cb6548269f1a2de278f9cae093adbe7cedf53eb3123cdbc0fd3973782` |
| `scripts/Assets/Scripts/Uni_X4M3ADoors.scr` | 414208 | `afadbde51b822bb810e1a25ce5e0b9dd21d06c161d470fdbfa47ea65338aee25` |
| `scripts/Assets/Scripts/Uni_X5M1AMoon.scr` | 365568 | `5cbb85062adc1ade23662f1a8bcfabc122a7d9462d09715a806b574fe2e4d4a8` |
| `scripts/Assets/Scripts/Uni_X5M1FPyre.scr` | 366592 | `1c8dd5d7c77836251f2a5b1df052afb89664e1dd37d2214de3d05a11ea16e7b3` |
| `scripts/Assets/Scripts/Uni_X5M2Sake.scr` | 378880 | `70cda310030f003e227d0a68e670a1111c3d7e1ec7ff23f77ab75622af8cece5` |

### models

317 path(s).

By folder (path and count only):

| Folder | Count |
| --- | ---: |
| `models/Assets/MODELS/space` | 31 |
| `models/Assets/MODELS/asteroids` | 12 |
| `models/Assets/MODELS/PlanetTemperate` | 3 |
| `models/Assets/MODELS/fbb` | 2 |
| `models/Assets/MODELS/fbch` | 2 |
| `models/Assets/MODELS/fbs` | 2 |
| `models/Assets/MODELS/fca` | 2 |
| `models/Assets/MODELS/fcl` | 2 |
| `models/Assets/MODELS/fcv` | 2 |
| `models/Assets/MODELS/fdd` | 2 |
| `models/Assets/MODELS/fdn` | 2 |
| `models/Assets/MODELS/ffa` | 2 |
| `models/Assets/MODELS/fff` | 2 |
| `models/Assets/MODELS/fft` | 2 |
| `models/Assets/MODELS/fsb` | 2 |
| `models/Assets/MODELS/gbs` | 2 |
| `models/Assets/MODELS/gca` | 2 |
| `models/Assets/MODELS/gcl` | 2 |
| `models/Assets/MODELS/gdd` | 2 |
| `models/Assets/MODELS/gdn` | 2 |
| `models/Assets/MODELS/gfa` | 2 |
| `models/Assets/MODELS/gff` | 2 |
| `models/Assets/MODELS/gft` | 2 |
| `models/Assets/MODELS/gsb` | 2 |
| `models/Assets/MODELS/hbs` | 2 |
| `models/Assets/MODELS/hca` | 2 |
| `models/Assets/MODELS/hcl` | 2 |
| `models/Assets/MODELS/hcv` | 2 |
| `models/Assets/MODELS/hdd` | 2 |
| `models/Assets/MODELS/hdn` | 2 |
| `models/Assets/MODELS/hfa` | 2 |
| `models/Assets/MODELS/hff` | 2 |
| `models/Assets/MODELS/hft` | 2 |
| `models/Assets/MODELS/hsb` | 2 |
| `models/Assets/MODELS/ibs` | 2 |
| `models/Assets/MODELS/ica` | 2 |
| `models/Assets/MODELS/icl` | 2 |
| `models/Assets/MODELS/icv` | 2 |
| `models/Assets/MODELS/idd` | 2 |
| `models/Assets/MODELS/idn` | 2 |
| `models/Assets/MODELS/ifa` | 2 |
| `models/Assets/MODELS/iff` | 2 |
| `models/Assets/MODELS/ift` | 2 |
| `models/Assets/MODELS/isb` | 2 |
| `models/Assets/MODELS/kbb` | 2 |
| `models/Assets/MODELS/kbs` | 2 |
| `models/Assets/MODELS/kca` | 2 |
| `models/Assets/MODELS/kcl` | 2 |
| `models/Assets/MODELS/kcv` | 2 |
| `models/Assets/MODELS/kdd` | 2 |
| `models/Assets/MODELS/kdn` | 2 |
| `models/Assets/MODELS/kdp` | 2 |
| `models/Assets/MODELS/kfa` | 2 |
| `models/Assets/MODELS/kff` | 2 |
| `models/Assets/MODELS/kft` | 2 |
| `models/Assets/MODELS/ksb` | 2 |
| `models/Assets/MODELS/ksd` | 2 |
| `models/Assets/MODELS/lbs` | 2 |
| `models/Assets/MODELS/lca` | 2 |
| `models/Assets/MODELS/lcl` | 2 |
| `models/Assets/MODELS/ldd` | 2 |
| `models/Assets/MODELS/ldn` | 2 |
| `models/Assets/MODELS/lfa` | 2 |
| `models/Assets/MODELS/lff` | 2 |
| `models/Assets/MODELS/lpft` | 2 |
| `models/Assets/MODELS/lsb` | 2 |
| `models/Assets/MODELS/mam` | 2 |
| `models/Assets/MODELS/mlc` | 2 |
| `models/Assets/MODELS/mmt` | 2 |
| `models/Assets/MODELS/msg` | 2 |
| `models/Assets/MODELS/mss` | 2 |
| `models/Assets/MODELS/pca` | 2 |
| `models/Assets/MODELS/pdn` | 2 |
| `models/Assets/MODELS/pfa` | 2 |
| `models/Assets/MODELS/pff` | 2 |
| `models/Assets/MODELS/pft` | 2 |
| `models/Assets/MODELS/PlanetSaturn` | 2 |
| `models/Assets/MODELS/rbb` | 2 |
| `models/Assets/MODELS/rbc` | 2 |
| `models/Assets/MODELS/rbs` | 2 |
| `models/Assets/MODELS/rca` | 2 |
| `models/Assets/MODELS/rcl` | 2 |
| `models/Assets/MODELS/rdd` | 2 |
| `models/Assets/MODELS/rde` | 2 |
| `models/Assets/MODELS/rdk` | 2 |
| `models/Assets/MODELS/rdn` | 2 |
| `models/Assets/MODELS/rfa` | 2 |
| `models/Assets/MODELS/rfr` | 2 |
| `models/Assets/MODELS/rft` | 2 |
| `models/Assets/MODELS/rln` | 2 |
| `models/Assets/MODELS/rsb` | 2 |
| `models/Assets/MODELS/xbs` | 2 |
| `models/Assets/MODELS/xdp` | 2 |
| `models/Assets/MODELS/xlux` | 2 |
| `models/Assets/MODELS/xmmer` | 2 |
| `models/Assets/MODELS/XMn` | 2 |
| `models/Assets/MODELS/xpy` | 2 |
| `models/Assets/MODELS/xsd` | 2 |
| `models/Assets/MODELS/xsmer` | 2 |
| `models/Assets/MODELS/xss` | 2 |
| `models/Assets/MODELS/xwreck` | 2 |
| `models/Assets/MODELS/zbs` | 2 |
| `models/Assets/MODELS/zca` | 2 |
| `models/Assets/MODELS/zcl` | 2 |
| `models/Assets/MODELS/zcv` | 2 |
| `models/Assets/MODELS/zdd` | 2 |
| `models/Assets/MODELS/zdn` | 2 |
| `models/Assets/MODELS/zfa` | 2 |
| `models/Assets/MODELS/zff` | 2 |
| `models/Assets/MODELS/zft` | 2 |
| `models/Assets/MODELS/zsb` | 2 |
| `models/Assets/MODELS` | 1 |
| `models/Assets/MODELS/fbox` | 1 |
| `models/Assets/MODELS/fms` | 1 |
| `models/Assets/MODELS/gbox` | 1 |
| `models/Assets/MODELS/gms` | 1 |
| `models/Assets/MODELS/hbox` | 1 |
| `models/Assets/MODELS/hms` | 1 |
| `models/Assets/MODELS/ibox` | 1 |
| `models/Assets/MODELS/ims` | 1 |
| `models/Assets/MODELS/kbox` | 1 |
| `models/Assets/MODELS/kms` | 1 |
| `models/Assets/MODELS/lbox` | 1 |
| `models/Assets/MODELS/lms` | 1 |
| `models/Assets/MODELS/mdd` | 1 |
| `models/Assets/MODELS/mdm` | 1 |
| `models/Assets/MODELS/missile` | 1 |
| `models/Assets/MODELS/pbox` | 1 |
| `models/Assets/MODELS/PlanetAnnwn` | 1 |
| `models/Assets/MODELS/PlanetBlack` | 1 |
| `models/Assets/MODELS/PlanetCityNight` | 1 |
| `models/Assets/MODELS/PlanetEarth` | 1 |
| `models/Assets/MODELS/PlanetFire` | 1 |
| `models/Assets/MODELS/PlanetForbidden` | 1 |
| `models/Assets/MODELS/PlanetGorn1` | 1 |
| `models/Assets/MODELS/PlanetGorn2` | 1 |
| `models/Assets/MODELS/PlanetGorn3` | 1 |
| `models/Assets/MODELS/PlanetHarmless` | 1 |
| `models/Assets/MODELS/PlanetHydra` | 1 |
| `models/Assets/MODELS/PlanetIce` | 1 |
| `models/Assets/MODELS/PlanetISC` | 1 |
| `models/Assets/MODELS/PlanetJupiter` | 1 |
| `models/Assets/MODELS/PlanetLuna` | 1 |
| `models/Assets/MODELS/PlanetLyra` | 1 |
| `models/Assets/MODELS/PlanetMars` | 1 |
| `models/Assets/MODELS/PlanetMirak` | 1 |
| `models/Assets/MODELS/PlanetNiflheim` | 1 |
| `models/Assets/MODELS/PlanetQo'nos` | 1 |
| `models/Assets/MODELS/PlanetRemus` | 1 |
| `models/Assets/MODELS/PlanetRomulus` | 1 |
| `models/Assets/MODELS/PlanetStorm` | 1 |
| `models/Assets/MODELS/PlanetUrzuli` | 1 |
| `models/Assets/MODELS/PlanetWater` | 1 |
| `models/Assets/MODELS/pms` | 1 |
| `models/Assets/MODELS/rbox` | 1 |
| `models/Assets/MODELS/rms` | 1 |
| `models/Assets/MODELS/shield` | 1 |
| `models/Assets/MODELS/Wormhole` | 1 |
| `models/Assets/MODELS/xbeam` | 1 |
| `models/Assets/MODELS/xbox` | 1 |
| `models/Assets/MODELS/xlp` | 1 |
| `models/Assets/MODELS/xpd` | 1 |
| `models/Assets/MODELS/xsh` | 1 |
| `models/Assets/MODELS/xwp` | 1 |
| `models/Assets/MODELS/zbox` | 1 |
| `models/Assets/MODELS/zms` | 1 |

First 10 paths:

| Path | Size | sha256 |
| --- | ---: | --- |
| `models/Assets/MODELS/asteroids/asteroid.mod` | 6844 | `8634cda3de7160c73659ea0c4b94b347e17cb5ef9e32fc9b2524e8e9eff08e73` |
| `models/Assets/MODELS/asteroids/IceL.mod` | 31276 | `519ded6c1c0b3de07e0f848539a2d2de6957db487cf555694d3efebbb1ce7d45` |
| `models/Assets/MODELS/asteroids/IceM.mod` | 31276 | `a7a609b5a5f72abad127e14efc20dbbd39d9532cd93ba877f0ce23a51653462b` |
| `models/Assets/MODELS/asteroids/IceS.mod` | 27968 | `1143cebe4ef53982e2f3f32b8ee979a15ca0f9fcb023fe088c0a642a54f03090` |
| `models/Assets/MODELS/asteroids/RockL.mod` | 14152 | `ffde87e94db1df5e5f84238de00b2c385f6a23655122b47670ab5180f2764717` |
| `models/Assets/MODELS/asteroids/RockM.mod` | 31748 | `e3aa0a883c1f0560b4e21ab9f7c038ecdf8f2c38f2413df9a9c2d1512b237686` |
| `models/Assets/MODELS/asteroids/RockS.mod` | 31748 | `61eaf7274fe7cc28282f0d0660037cc897979b696db33f16a89a380408a2e0c0` |
| `models/Assets/MODELS/asteroids/RockS_brk.mod` | 52672 | `dcb9d0530783f7c63711f2ed672f164b99af7bd1cf4a68ceb32d938bdc7e9ad0` |
| `models/Assets/MODELS/asteroids/xa1.mod` | 6836 | `20810d603e9a1855460c139ae08ff4dc95d809ec7468da98ad8f32bdcbcfa664` |
| `models/Assets/MODELS/asteroids/xa2.mod` | 27972 | `37ae5e3f3be616754208f9f2eedb156b4ac954a2a4c629b6717c17eeb1338f92` |

### q3-archives

1 path(s).

| Path | Size | sha256 |
| --- | ---: | --- |
| `sprites/Assets/Sprites/sprites.q3` | 80717666 | `8558ca51240843c3e5595a3b4820ab97a7f4314546cfb4451428b3383d875346` |

### shiplist

2 path(s).

| Path | Size | sha256 |
| --- | ---: | --- |
| `tables/Assets/specs/shiplist.txt` | 647855 | `44f09e060788c3e4ea15a178ee14189865c6e8db6776b25e7c0b6fe17150dfb9` |
| `tables/MetaAssets/shiplist.txt` | 647465 | `c201c5575a473d691ac48fba3fa56e226281e96183867d95644b43f014a825bd` |

### sounds-index

1 path(s).

| Path | Size | sha256 |
| --- | ---: | --- |
| `tables/Assets/Sound/sounds.txt` | 107276 | `ca055518c8ebb408a1ea970b30bb751af377d17449e462db5b554e6c5b824f2c` |

### string-table

4 path(s).

| Path | Size | sha256 |
| --- | ---: | --- |
| `tables/Assets/Strings/aaStrings.txt` | 327082 | `d09a7d7aa9ddb8590bf380e994579706a47f1ccf156df247d7548b953d8337a1` |
| `tables/Assets/Strings/quicktips.txt` | 115738 | `f0462156232da1eccb2a0c2258e478581927482ec897c203f61258a0fa742bce` |
| `tables/Assets/Strings/shipnames.txt` | 228780 | `eeb230fcce6fc79a100abfc6ece184846397a417d102ec3297155de4f1d50ca8` |
| `tables/Assets/Strings/strings.txt` | 103520 | `dc85f31ecc4ddf0ab541f07f914e03431fc402d685491296ab85f1c5829a9fa3` |

### textures

2649 path(s).

By folder (path and count only):

| Folder | Count |
| --- | ---: |
| `textures/Assets/MODELS/space` | 160 |
| `textures/Assets/textures` | 73 |
| `textures/Assets/MODELS/asteroids` | 38 |
| `textures/Assets/MODELS/ifa` | 30 |
| `textures/Assets/MODELS/iff` | 30 |
| `textures/Assets/MODELS/zfa` | 30 |
| `textures/Assets/MODELS/zff` | 28 |
| `textures/Assets/MODELS/zcl` | 27 |
| `textures/Assets/MODELS/icl` | 26 |
| `textures/Assets/MODELS/icv` | 26 |
| `textures/Assets/MODELS/isb` | 26 |
| `textures/Assets/MODELS/pfa` | 26 |
| `textures/Assets/MODELS/zsb` | 26 |
| `textures/Assets/MODELS/kdd` | 25 |
| `textures/Assets/MODELS/fbb` | 24 |
| `textures/Assets/MODELS/fbch` | 24 |
| `textures/Assets/MODELS/fca` | 24 |
| `textures/Assets/MODELS/fcl` | 24 |
| `textures/Assets/MODELS/fdd` | 24 |
| `textures/Assets/MODELS/ffa` | 24 |
| `textures/Assets/MODELS/fff` | 24 |
| `textures/Assets/MODELS/kbb` | 24 |
| `textures/Assets/MODELS/kcl` | 24 |
| `textures/Assets/MODELS/kdn` | 24 |
| `textures/Assets/MODELS/kff` | 24 |
| `textures/Assets/MODELS/ldn` | 24 |
| `textures/Assets/MODELS/mam` | 24 |
| `textures/Assets/MODELS/mdm` | 24 |
| `textures/Assets/MODELS/rbc` | 24 |
| `textures/Assets/MODELS/rde` | 24 |
| `textures/Assets/MODELS/rln` | 24 |
| `textures/Assets/MODELS/kca` | 23 |
| `textures/Assets/MODELS/kfa` | 23 |
| `textures/Assets/MODELS/fbs` | 22 |
| `textures/Assets/MODELS/fdn` | 22 |
| `textures/Assets/MODELS/gbs` | 22 |
| `textures/Assets/MODELS/gdn` | 22 |
| `textures/Assets/MODELS/hbs` | 22 |
| `textures/Assets/MODELS/ibs` | 22 |
| `textures/Assets/MODELS/kbs` | 22 |
| `textures/Assets/MODELS/lbs` | 22 |
| `textures/Assets/MODELS/lca` | 22 |
| `textures/Assets/MODELS/lfa` | 22 |
| `textures/Assets/MODELS/mdd` | 22 |
| `textures/Assets/MODELS/rbb` | 22 |
| `textures/Assets/MODELS/rbs` | 22 |
| `textures/Assets/MODELS/rdd` | 22 |
| `textures/Assets/MODELS/rdn` | 22 |
| `textures/Assets/MODELS/xbs` | 22 |
| `textures/Assets/MODELS/zdd` | 22 |
| `textures/Assets/MODELS/zdn` | 22 |
| `textures/Assets/MODELS/zca` | 21 |
| `textures/Assets/MODELS/hcv` | 20 |
| `textures/Assets/MODELS/ica` | 20 |
| `textures/Assets/MODELS/idn` | 20 |
| `textures/Assets/MODELS/kcv` | 20 |
| `textures/Assets/MODELS/lsb` | 20 |
| `textures/Assets/MODELS/xlux` | 20 |
| `textures/Assets/MODELS/zbs` | 20 |
| `textures/Assets/MODELS/zcv` | 20 |
| `textures/Assets/MODELS/fsb` | 19 |
| `textures/Assets/MODELS/gca` | 18 |
| `textures/Assets/MODELS/gcl` | 18 |
| `textures/Assets/MODELS/gff` | 18 |
| `textures/Assets/MODELS/hca` | 18 |
| `textures/Assets/MODELS/hff` | 18 |
| `textures/Assets/MODELS/lcl` | 18 |
| `textures/Assets/MODELS/msg` | 18 |
| `textures/Assets/MODELS/mss` | 18 |
| `textures/Assets/MODELS/pca` | 18 |
| `textures/Assets/MODELS/pdn` | 18 |
| `textures/Assets/MODELS/pff` | 18 |
| `textures/Assets/MODELS/rca` | 18 |
| `textures/Assets/MODELS/rcl` | 18 |
| `textures/Assets/MODELS/rdk` | 18 |
| `textures/Assets/MODELS/rfa` | 18 |
| `textures/Assets/MODELS/rfr` | 18 |
| `textures/Assets/MODELS/rsb` | 18 |
| `textures/Assets/MODELS/xsmer` | 18 |
| `textures/Assets/MODELS/xss` | 18 |
| `textures/Assets/MODELS/hdn` | 17 |
| `textures/Assets/MODELS/PlanetTemperate` | 17 |
| `textures/Assets/MODELS/hcl` | 16 |
| `textures/Assets/MODELS/hfa` | 16 |
| `textures/Assets/MODELS/ksb` | 16 |
| `textures/Assets/MODELS/lff` | 16 |
| `textures/Assets/MODELS/mmt` | 16 |
| `textures/Assets/MODELS/gfa` | 14 |
| `textures/Assets/MODELS/hdd` | 14 |
| `textures/Assets/MODELS/hft` | 14 |
| `textures/Assets/MODELS/hsb` | 14 |
| `textures/Assets/MODELS/kdp` | 14 |
| `textures/Assets/MODELS/xmmer` | 14 |
| `textures/Assets/MODELS/fcv` | 12 |
| `textures/Assets/MODELS/gsb` | 12 |
| `textures/Assets/MODELS/ldd` | 12 |
| `textures/Assets/MODELS/PlanetBlack` | 12 |
| `textures/Assets/MODELS/PlanetCityNight` | 12 |
| `textures/Assets/MODELS/PlanetEarth` | 12 |
| `textures/Assets/MODELS/PlanetFire` | 12 |
| `textures/Assets/MODELS/PlanetGorn1` | 12 |
| `textures/Assets/MODELS/PlanetGorn2` | 12 |
| `textures/Assets/MODELS/PlanetGorn3` | 12 |
| `textures/Assets/MODELS/PlanetHydra` | 12 |
| `textures/Assets/MODELS/PlanetISC` | 12 |
| `textures/Assets/MODELS/PlanetLuna` | 12 |
| `textures/Assets/MODELS/PlanetLyra` | 12 |
| `textures/Assets/MODELS/PlanetMars` | 12 |
| `textures/Assets/MODELS/PlanetMirak` | 12 |
| `textures/Assets/MODELS/PlanetQo'nos` | 12 |
| `textures/Assets/MODELS/PlanetRemus` | 12 |
| `textures/Assets/MODELS/PlanetRomulus` | 12 |
| `textures/Assets/MODELS/xwreck` | 12 |
| `textures/Assets/MODELS/gdd` | 10 |
| `textures/Assets/MODELS/idd` | 10 |
| `textures/Assets/MODELS/lpft` | 10 |
| `textures/Assets/MODELS/pft` | 10 |
| `textures/Assets/MODELS/zft` | 10 |
| `textures/Assets/MODELS/PlanetSaturn` | 9 |
| `textures/Assets/MODELS/fft` | 8 |
| `textures/Assets/MODELS/gft` | 8 |
| `textures/Assets/MODELS/ift` | 8 |
| `textures/Assets/MODELS/kft` | 8 |
| `textures/Assets/MODELS/rft` | 8 |
| `textures/Assets/MODELS/xdp` | 8 |
| `textures/Assets/MODELS/ksd` | 7 |
| `textures/Assets/MODELS/xsd` | 7 |
| `textures/Assets/MODELS/mlc` | 6 |
| `textures/Assets/MODELS/PlanetAnnwn` | 6 |
| `textures/Assets/MODELS/PlanetForbidden` | 6 |
| `textures/Assets/MODELS/PlanetHarmless` | 6 |
| `textures/Assets/MODELS/PlanetIce` | 6 |
| `textures/Assets/MODELS/PlanetJupiter` | 6 |
| `textures/Assets/MODELS/PlanetNiflheim` | 6 |
| `textures/Assets/MODELS/PlanetStorm` | 6 |
| `textures/Assets/MODELS/PlanetUrzuli` | 6 |
| `textures/Assets/MODELS/PlanetWater` | 6 |
| `textures/Assets/MODELS/XMn` | 6 |
| `textures/Assets/MODELS/xpy` | 6 |
| `textures/Assets/bitmaps/ui` | 2 |
| `textures/Assets/MODELS/fbox` | 2 |
| `textures/Assets/MODELS/fms` | 2 |
| `textures/Assets/MODELS/gbox` | 2 |
| `textures/Assets/MODELS/gms` | 2 |
| `textures/Assets/MODELS/hbox` | 2 |
| `textures/Assets/MODELS/hms` | 2 |
| `textures/Assets/MODELS/ibox` | 2 |
| `textures/Assets/MODELS/ims` | 2 |
| `textures/Assets/MODELS/kbox` | 2 |
| `textures/Assets/MODELS/kms` | 2 |
| `textures/Assets/MODELS/lbox` | 2 |
| `textures/Assets/MODELS/lms` | 2 |
| `textures/Assets/MODELS/missile` | 2 |
| `textures/Assets/MODELS/pbox` | 2 |
| `textures/Assets/MODELS/pms` | 2 |
| `textures/Assets/MODELS/rbox` | 2 |
| `textures/Assets/MODELS/rms` | 2 |
| `textures/Assets/MODELS/Wormhole` | 2 |
| `textures/Assets/MODELS/xbeam` | 2 |
| `textures/Assets/MODELS/xbox` | 2 |
| `textures/Assets/MODELS/xlp` | 2 |
| `textures/Assets/MODELS/xpd` | 2 |
| `textures/Assets/MODELS/xsh` | 2 |
| `textures/Assets/MODELS/zbox` | 2 |
| `textures/Assets/MODELS/zms` | 2 |
| `textures/Assets/maps` | 1 |
| `textures/Assets/textures/french` | 1 |
| `textures/Assets/textures/german` | 1 |

First 10 paths:

| Path | Size | sha256 |
| --- | ---: | --- |
| `textures/Assets/bitmaps/ui/off-scr-icon-grid.bmp` | 18476 | `b0c2358a5a2d31a7c62d0d0213ab306a3c1d92cad27627e88a01e147372b90d1` |
| `textures/Assets/bitmaps/ui/offScr.BMP` | 33846 | `d60fdc2183cf1095b162d672b7de4b896aedc60e9f5681f765c3e58ecb06b164` |
| `textures/Assets/maps/testmap.bmp` | 66614 | `5218be2a720ab766b9329465786c9dc59eeb1034c2404fbe6971cce80cb41488` |
| `textures/Assets/MODELS/asteroids/6Ice_1.bmp` | 66612 | `388318a901d28c67c3d8e5302b80efce7d2c8807d281f90d96c5fecb98ba7728` |
| `textures/Assets/MODELS/asteroids/6Ice_2.bmp` | 17460 | `362c4e8c98211ab707489828c41e0fe663af4d8ef79483d49705547dd59e045b` |
| `textures/Assets/MODELS/asteroids/6Ice_3.bmp` | 5172 | `a0f4dede3699e8be3e0eefc4974511f55100ae5c3890ff3e5e937db05338d0b3` |
| `textures/Assets/MODELS/asteroids/7Ice_1.bmp` | 66612 | `f138699d544f82b45e20c932c20ba88d42667fd4bd3fd12932d0db2a37339f51` |
| `textures/Assets/MODELS/asteroids/7Ice_2.bmp` | 17460 | `4c062d76902730265684cab56cf75d514266e1f2be5053c7192a7369a75925fa` |
| `textures/Assets/MODELS/asteroids/7Ice_3.bmp` | 5172 | `6bf715fe56104ec6ae56bb74b967f5905b663ceb3fffe11b34cb4d4dd652c3f2` |
| `textures/Assets/MODELS/asteroids/_2xan_1.bmp` | 66612 | `64265c4c8a72bf9058b69566c70f29e3eb6e605da81852c1c9d1d5fa17f999c8` |

## `*.q3` archives

- Extracted tree: 1 file(s)
  - `sprites/Assets/Sprites/sprites.q3` size=80717666 sha256=`8558ca51240843c3e5595a3b4820ab97a7f4314546cfb4451428b3383d875346` format=`unidentified` entryCount=None
    - No identifiable archive directory (not ZIP or PACK).
- Reference tree: 1 file(s)
  - `Assets/Sprites/sprites.q3` size=80717666 sha256=`8558ca51240843c3e5595a3b4820ab97a7f4314546cfb4451428b3383d875346` format=`unidentified` entryCount=None
    - No identifiable archive directory (not ZIP or PACK).

## GUI / non-model BMP folders

Total BMPs: 2649. In a `models` folder: 2571. Outside `models`: 78.

| Folder | BMP count |
| --- | ---: |
| `textures/Assets/textures` | 73 |
| `textures/Assets/bitmaps/ui` | 2 |
| `textures/Assets/maps` | 1 |
| `textures/Assets/textures/french` | 1 |
| `textures/Assets/textures/german` | 1 |

### Self-illumination naming patterns

| Pattern | Count |
| --- | ---: |
| `-i` | 1 |
| `-I` | 1 |

### BMP `_<n>i` self-illumination pairs (header only, no pixel reads)

- Illum files matching `_<n>i`: 1073
- Paired with a base texture (`_<n>`): 1072
- Missing base: 1
- Unreadable BMP header: 0
- Bit-depth matches: 1071; differs: 1
- Width/height matches: 906; differs: 166
- Illum `biBitCount` histogram: 8=1072, 4=1

Pairs whose `biBitCount` differs (path and header fields only):

| Illum | Base | Illum bitCount | Base bitCount | Illum WxH | Base WxH | Compression |
| --- | --- | ---: | ---: | --- | --- | --- |
| `textures/Assets/MODELS/ksd/Ksd_1_3i.bmp` | `textures/Assets/MODELS/ksd/Ksd_1_3.bmp` | 4 | 8 | 256x256 | 256x256 | BI_RGB/BI_RGB |

## `.bft` files (path and size only)

Count: 126. Observed by path and size only; no .bft payload is parsed or logged.

### `fonts/Assets/aafonts` (126 files)

| Path | Size | sha256 |
| --- | ---: | --- |
| `fonts/Assets/aafonts/Federation10.bft` | 27843 | `62659274e343bdb7c1216c255e9923c91302523849b956b5a6a385dbc37e7d23` |
| `fonts/Assets/aafonts/Federation11.bft` | 32482 | `ab7a2669b594a14d503b2913d51cf979ca6679afe21e551af71acf1d04761068` |
| `fonts/Assets/aafonts/Federation12.bft` | 36495 | `3731e51f38e5f55ad7ba63357c8a4be42bb7b559407774d712be4e4acca0cad8` |
| `fonts/Assets/aafonts/Federation14.bft` | 46955 | `d9c0d1a7bbe65e477e1250cf4d232c06307307b9e870f7a019fdb16660452fe1` |
| `fonts/Assets/aafonts/Federation16.bft` | 58840 | `12e88bd8335f2d8c572dd01ffbde74e68b3937c49797002816cd9cd3e069c245` |
| `fonts/Assets/aafonts/Federation18.bft` | 71801 | `65cec60f4ed1f94bd0ef8d08f4fa70929bf5a16ac5220dc00ab5d49ad5ccda4a` |
| `fonts/Assets/aafonts/Federation20.bft` | 86081 | `1d25e4c89387de921b098acb7fb3f7494835a73ddc23df90e8310eac4b4e6cfd` |
| `fonts/Assets/aafonts/Federation22.bft` | 101971 | `9c5daefdad85da6aa755fec4be18b4fb85cea7952bf630e647f4afdc661b4a17` |
| `fonts/Assets/aafonts/Federation24.bft` | 118586 | `0a8113ef188f4984857d5e2daf47e6bf54aeb0abb3e153742a6cd28751608a08` |
| `fonts/Assets/aafonts/Federation5.bft` | 11806 | `e905527e1eeca560a237a872e6ea7ee14cadc01808a6032c46219fd69032227b` |
| `fonts/Assets/aafonts/Federation6.bft` | 15133 | `82531c92f0927ab0b9b4110ab3038e2c2554a4fd5a1df4125cdc300dcfbf5c3f` |
| `fonts/Assets/aafonts/Federation7.bft` | 17599 | `a6210c6ec63c08a0537724e94f4d6487a81650fe154c40f5b09de28d239a8896` |
| `fonts/Assets/aafonts/Federation8.bft` | 20490 | `821558a1d45d239c7228cfcd031c5fe50209b132f8eaeee6e4485cfb9f3e5311` |
| `fonts/Assets/aafonts/Federation9.bft` | 24426 | `0c710abb220749362c05b3c7992e1ba09225490f6e0387e5927da48320f76b1b` |
| `fonts/Assets/aafonts/Klingon10.bft` | 23794 | `fa86495fd060e14366f254caf903f377046f79edded2273983fb0f4c126b17c0` |
| `fonts/Assets/aafonts/Klingon11.bft` | 27783 | `5c166ef4a2efb41acb6d03d66207bf8b3cb7ccc8a0738aa757b08148d2f42375` |
| `fonts/Assets/aafonts/Klingon12.bft` | 31047 | `30de3afca8bf5585db8d483317e8682ada107124241cf3613a47c0a430698114` |
| `fonts/Assets/aafonts/Klingon14.bft` | 39768 | `7ac68be372d3f6618a3db5ca735263ee5f82e6bed3b1400fbbff37d427f80468` |
| `fonts/Assets/aafonts/Klingon16.bft` | 49134 | `5b8e9454f5828b4201bb81ecd2a220ba81e6bd098e969ddf4cf718ebfe5140f2` |
| `fonts/Assets/aafonts/Klingon18.bft` | 59378 | `f269fc08ac12727fb40586a40fc8ad29ce21f1c882cf32345eee42791b1e9a91` |
| `fonts/Assets/aafonts/Klingon20.bft` | 71028 | `3def44bdec6e5996dd69c948b0b0b32c816edeb200d390b7afe4287d27fbdfa9` |
| `fonts/Assets/aafonts/Klingon22.bft` | 83739 | `55c63b7507db232e1b82300f55c120402776f8205fdf6e2f4324ebebea81fa9a` |
| `fonts/Assets/aafonts/Klingon24.bft` | 97784 | `a5aeecd60734028a6edbad1e9fbf4d80f1d0f9a02284f97ec0a047a352a20ce7` |
| `fonts/Assets/aafonts/Klingon5.bft` | 9675 | `3056cd1881e9290f0acd5ea865e579aefa890d9b92e428f06f63863e95029e57` |
| `fonts/Assets/aafonts/Klingon6.bft` | 11417 | `e131233880e0938ee0b402d80281b67a063b425b97dcbb5a1a827890896e45e1` |
| `fonts/Assets/aafonts/Klingon7.bft` | 15120 | `7b0d2da5e8b8bfb5fafe2b7143269842d2f1af92bbcd4cb836dec228d967d72e` |
| `fonts/Assets/aafonts/Klingon8.bft` | 16955 | `4fbe4f4ab81510802e2df8062f8824064b10122ba72c46031799d3cb4d4daeb1` |
| `fonts/Assets/aafonts/Klingon9.bft` | 20282 | `540a051fa1ef66bddf0b092c0f83e4499056e4d6e50a0eb62ee2649c8dd1e1bd` |
| `fonts/Assets/aafonts/arial10.bft` | 22986 | `6808fe130f83c58956b352139898ae8272c8bcd13fbb6130703a7647ddbc3eed` |
| `fonts/Assets/aafonts/arial11.bft` | 30323 | `9a1fa5a090414b932be1c01880d8483be8e3e4287f88d0b5b6d8b897ca942d95` |
| `fonts/Assets/aafonts/arial12.bft` | 34402 | `7441d8128c9386edc529dc1caba3343f379d78e8642a6f50f92eb6c0293636d1` |
| `fonts/Assets/aafonts/arial14.bft` | 43787 | `84f834f06b0aab298f5981eb4952b25aa3cc8e42ab369b1ff83f6cc9a94daefb` |
| `fonts/Assets/aafonts/arial16.bft` | 54986 | `d4302352661866aa7b396a85a80070169a1a90eabe4efab1030b52e71da3965e` |
| `fonts/Assets/aafonts/arial18.bft` | 66523 | `b315096c79797c07f3034a03eb5ee2c9d5d09eb955f163322d58c3bfe82a500e` |
| `fonts/Assets/aafonts/arial20.bft` | 79058 | `bf56e6f3090a1d59b99b155a978758e66f694dcab640aee0ddf56816bb46dafd` |
| `fonts/Assets/aafonts/arial22.bft` | 93575 | `786c09fb57e08780f03ac7142b69a2fdd2f6867fafd01157d1a9888300fdfb94` |
| `fonts/Assets/aafonts/arial24.bft` | 109303 | `33fafe1d38833030e9c6c14f4b2d5fa804517ba901a9b0163e946600f045538d` |
| `fonts/Assets/aafonts/arial5.bft` | 10194 | `a6fdca63165c22d20fa9a05b18abeb26e4ffb5fe4ec61731cc84235989240af1` |
| `fonts/Assets/aafonts/arial6.bft` | 12484 | `dd6b3b4e7d8db3703a2459c88da6893d1261ee0972441ef42c015ff623fc6356` |
| `fonts/Assets/aafonts/arial7.bft` | 14800 | `0f162ca3497426b16cb4e326d7eaaccc8901069b2180d77786de41a475f13c8e` |
| `fonts/Assets/aafonts/arial8.bft` | 17231 | `1a3eba70b98929ea28eb9e0904739357e5571856ebc309fae1f7062dcd8f56d3` |
| `fonts/Assets/aafonts/arial9.bft` | 20995 | `44eaaded6dfc040d22c4075411cbe117579d464910e6c52053dab4a8987243b9` |
| `fonts/Assets/aafonts/gorn10.bft` | 21254 | `25f8e0fbd655f594e7bccbbb72177499ae6b4b4c9f2d1959b5fa848db75f02e0` |
| `fonts/Assets/aafonts/gorn11.bft` | 24825 | `82c6d10eb6fa499d37ca148354ca48954452aebee75562c3487366403bbd56e8` |
| `fonts/Assets/aafonts/gorn12.bft` | 28205 | `e72b6a398916695141206d7b27b8f1c3feabd0b0bfade2acd5a3949aac9a3419` |
| `fonts/Assets/aafonts/gorn14.bft` | 36140 | `c03c1d728f3ade1a90c133036161ab6ad470cca6bb8aaaf36edb59d436d90086` |
| `fonts/Assets/aafonts/gorn16.bft` | 45159 | `6b523c6a138cbab649981865d5ecb24feacab72c4e28de9c1cd3bd1b8a7e3fb9` |
| `fonts/Assets/aafonts/gorn18.bft` | 54967 | `e321eb843be9e1b4674c2646f17588be533bd5ac5c344e947fde0b330eabc495` |
| `fonts/Assets/aafonts/gorn20.bft` | 64967 | `7948627d0c72121d051d13d9c8aebe5b70fa6f3011ab2605c36053b59e7c2339` |
| `fonts/Assets/aafonts/gorn22.bft` | 76275 | `f40ef969d30caaf24520959fb1d35dcd004fcc8be07e129481a4d0da954cb27b` |
| `fonts/Assets/aafonts/gorn24.bft` | 88023 | `1af06f36f56ff1d516b007c495e4883d91ae1605e5a8150ce0946b69aec52d81` |
| `fonts/Assets/aafonts/gorn5.bft` | 10177 | `ac73ed476412fe96c38c8047578cb16ae8074ab56c679c8c601d5b1b4454c03c` |
| `fonts/Assets/aafonts/gorn6.bft` | 12172 | `e5513374c9929f0bc9749331e981eeef1ef24fe318132171812d98cdc861d8c9` |
| `fonts/Assets/aafonts/gorn7.bft` | 14519 | `37d18cff2f0848cb86e692b8edab1af776b578d72115b4517af9373243971a6a` |
| `fonts/Assets/aafonts/gorn8.bft` | 16192 | `11b855c25c9c67dc253809f1333ff55c619d1c3622193db80628db02e63b210e` |
| `fonts/Assets/aafonts/gorn9.bft` | 19086 | `f2724632e3512ff47d8ca83716141e73d1b56cd9f97a7dd57ec5194363b28c56` |
| `fonts/Assets/aafonts/hydran10.bft` | 30266 | `08a8baca35a4f423e4265e0ac3f2e68710a600c45293951b065e5a5920633445` |
| `fonts/Assets/aafonts/hydran11.bft` | 34411 | `78003a4f39deef4a794836105990ad7f0f2f3531a2ce6d77d1d919bf57d30ed8` |
| `fonts/Assets/aafonts/hydran12.bft` | 41596 | `e596165d1f6d84334223db393aebfc60bc3aa7f4ec1c5f69a10e0f7a17c54053` |
| `fonts/Assets/aafonts/hydran14.bft` | 53399 | `95096549cf8fa038c32d53c384ae15e0241bae5d1c8f154393507b2c8080e025` |
| `fonts/Assets/aafonts/hydran16.bft` | 66239 | `cc3144a3a370a94cc3257e1eb04f0d0e724b3b2ef918029d5da1180c10fa3141` |
| `fonts/Assets/aafonts/hydran18.bft` | 80399 | `8fc0143679776a708f02c021c76da2ee6260842eec860efdd62527a0e99c8d4b` |
| `fonts/Assets/aafonts/hydran20.bft` | 96021 | `4e7b92e32edebf7ac662e3c6fbc052c7718f76fceb438a7d7e22bb6c8fdcfd80` |
| `fonts/Assets/aafonts/hydran22.bft` | 115974 | `bf20559d5b0122185764cece76c632c55a8d9b89c60fb806961932960815bd36` |
| `fonts/Assets/aafonts/hydran24.bft` | 135587 | `08def19e6970b0d3e80f0a0e08a8581798b1b8c29c50c359dbd6a1bc486b370b` |
| `fonts/Assets/aafonts/hydran5.bft` | 13017 | `ea2fa7251fc74ab17574a587e4e623863156d6f5bbe4be3d6d3a169c124ee190` |
| `fonts/Assets/aafonts/hydran6.bft` | 15089 | `e63ddd6c6b1d2820870dd1149a1602032a0b5e0f436fe0082fdc31c5ad2f8c0a` |
| `fonts/Assets/aafonts/hydran7.bft` | 18642 | `fdc2cae33aef3b6c8443264e9ca8b2a0cb0d79ae36a5849cfb6268ba6bef4c6c` |
| `fonts/Assets/aafonts/hydran8.bft` | 21083 | `7fd7ce203c69ecefc57ac28a7ad1c3678bb0c6f4d187b5f22b077671983ee3a1` |
| `fonts/Assets/aafonts/hydran9.bft` | 25853 | `05dc5db167c73043ebf02f07085d569c5f8c6b186db766ecc8d8594ae2b52646` |
| `fonts/Assets/aafonts/isc10.bft` | 24017 | `361dc9303b00bf5d27d4117053969866292af0aa6d03d93993572c49eb986953` |
| `fonts/Assets/aafonts/isc11.bft` | 27830 | `36d5eb1e01dac6c37ece4baa43d4b465dc9f3ba58cafb422264b34650447c783` |
| `fonts/Assets/aafonts/isc12.bft` | 31172 | `33723720bdb057762d0617b36b7814672abc6206847ce29d10bdcaf4f447b2e2` |
| `fonts/Assets/aafonts/isc14.bft` | 39627 | `78cb5590390fcdf6faa5b1efba26c20689fc193969ae1d08b5ecacad7c8c9ba3` |
| `fonts/Assets/aafonts/isc16.bft` | 48786 | `d664d854103195731d2bb8b5c69ec59565f3e4ad35458ecdd3e6132de23181b6` |
| `fonts/Assets/aafonts/isc18.bft` | 58978 | `808b80e59143560d26aba842270101f534cf1cf9b5442adccd44b590f5635317` |
| `fonts/Assets/aafonts/isc20.bft` | 71038 | `06219c90d607efd1cc1fe60225e9db9011dda55ba1c94afd19ad4e4242d95df9` |
| `fonts/Assets/aafonts/isc22.bft` | 84152 | `e850d00d2994ed023d3a991152e3bf138217683e332000361efb3ca5da475262` |
| `fonts/Assets/aafonts/isc24.bft` | 97625 | `f8f1639f8513a8f61e8d65f7d86576f751ed618a0d79b1ad8e834bf18ca6fce5` |
| `fonts/Assets/aafonts/isc5.bft` | 10630 | `14f4f778b57e0532b05ff9dd25e03fd915dcf4c45bf5c84fcc8880b41cad467c` |
| `fonts/Assets/aafonts/isc6.bft` | 12973 | `9f27d5831bd96ae0291624c056c8b1e060afd083b0784a2772168439eae0adc9` |
| `fonts/Assets/aafonts/isc7.bft` | 14683 | `0f086a631fd7ab6e172f455ab76600c7449cdef558638fb7efe2fb37091e9730` |
| `fonts/Assets/aafonts/isc8.bft` | 17265 | `d0af5b3f22b12421399a2b9f8ef7343e2fbe578aab784b94f2548fd09082dbf6` |
| `fonts/Assets/aafonts/isc9.bft` | 20405 | `46026d3fb73d987c89a342c97801bf516a2c8a045ac4b210a5169b6fc98d6cae` |
| `fonts/Assets/aafonts/lyran10.bft` | 23931 | `8997ded76b7e049015a4bd592d5cafdf3f1b6ee9872dd0050472774398d4527b` |
| `fonts/Assets/aafonts/lyran11.bft` | 30442 | `3ad77df17075dfa597532a7b9293c4db7441b1d2d267c7c2bf606ec8c2b6ba82` |
| `fonts/Assets/aafonts/lyran12.bft` | 34905 | `641e37af5cfbe9e2c18e6dbaf90c94748bb15327d4495972590fa7376ae7653b` |
| `fonts/Assets/aafonts/lyran14.bft` | 44812 | `8611f51152fad4b42b33925b816be07242abfe05aaf222b2eb82c0a611cb4d62` |
| `fonts/Assets/aafonts/lyran16.bft` | 55544 | `7a0af629dd34efd50380cda49e780d7e594239300a54fd84a987320af31cd108` |
| `fonts/Assets/aafonts/lyran18.bft` | 68426 | `b431451982521cb5d82490a1f137836caf7638b42ac2913a5246c022e00354e8` |
| `fonts/Assets/aafonts/lyran20.bft` | 81231 | `b75e16b306a6637b339ff4d7f4ab44af2382325d8083c626111629c8377fc278` |
| `fonts/Assets/aafonts/lyran22.bft` | 96163 | `3d5f11018ad50edb01be19489f2bd9571c064570254e4fe26e1d508dfc09ef49` |
| `fonts/Assets/aafonts/lyran24.bft` | 111969 | `9314ebbe2f227ed5f31f9022292423376585c51a8ced0ee646535c2aae7c5a31` |
| `fonts/Assets/aafonts/lyran5.bft` | 10388 | `8e930924d9e3a8a66c6f8733a45fb2f4a1f994d31b5705ee5da7b4d8d32ae119` |
| `fonts/Assets/aafonts/lyran6.bft` | 12532 | `d0cf50f7c1e51daa6e7aa19e5507e27bd53097f107af3cba7e02c25eeaddb960` |
| `fonts/Assets/aafonts/lyran7.bft` | 14911 | `84ea0d8471f465763b907336177010cd554cd4d7e849a88112492e143cb3f41b` |
| `fonts/Assets/aafonts/lyran8.bft` | 17376 | `2e1d1a23cab2ce915185955797a659dd6d231b99d2355883ad2b1768995a6635` |
| `fonts/Assets/aafonts/lyran9.bft` | 20353 | `d35a82e2e42e9ced5ec2e5c1856b5506a932512dd2f034f145b4f865fa0005ee` |
| `fonts/Assets/aafonts/mirak10.bft` | 23242 | `8fcdc2bc2c34653e23fe778bc03abe023cc268eb1080f5d70ff38d2f6963766b` |
| `fonts/Assets/aafonts/mirak11.bft` | 27213 | `22c07d39aadd7aa07547a39c7a79d1e119a1d7c489e49262af059120758ff19f` |
| `fonts/Assets/aafonts/mirak12.bft` | 29786 | `b5454d942d1b59b410838d43a226b4871a9a109627698051ad44a3bc7e568be9` |
| `fonts/Assets/aafonts/mirak14.bft` | 37969 | `b2cb11de4496ed62e4cce9c1568220238590aae8630f4255b2cc858b024f9ffc` |
| `fonts/Assets/aafonts/mirak16.bft` | 46993 | `c9b17db439dd7f269e17fac0a8d776150759d81b8a0a8c5ba7d1fd42718f73e6` |
| `fonts/Assets/aafonts/mirak18.bft` | 57179 | `64374a424eed254f9a30a4d499eb2c679d723f9eca61acf5e94dcc034c40ffbd` |
| `fonts/Assets/aafonts/mirak20.bft` | 68732 | `3f95331f7e56521ec174357490fedaf7ed1dfdd53fc0239b01c88e6366f44016` |
| `fonts/Assets/aafonts/mirak22.bft` | 81109 | `db86fa0c4afcd14c198d7fef724a462b8853ae30d8771b2526800cf46375a67f` |
| `fonts/Assets/aafonts/mirak24.bft` | 94257 | `b52ceea155dbbacb01dc8ce1a7a73448d3ac304f79d6deddaf1ef364e44e6f82` |
| `fonts/Assets/aafonts/mirak5.bft` | 10653 | `e9e51955ee1bed2309d8ab87ffc66aeea0188ec8942aedb6af73185dee591be1` |
| `fonts/Assets/aafonts/mirak6.bft` | 12572 | `833664855f982c0b89f521383300aaf9bc9ddc68153e6d17a0215af87d0a7699` |
| `fonts/Assets/aafonts/mirak7.bft` | 15109 | `018458ccc39d1e106e77fb96cea403a324e4a716c08a8ae4ca9f57c3800e4de0` |
| `fonts/Assets/aafonts/mirak8.bft` | 17425 | `e5b9b35ab6199c2d5955018732b36a2b367e404cf468e9b1d2b229cf3e78f645` |
| `fonts/Assets/aafonts/mirak9.bft` | 20738 | `fa66f26950a292f99b5d0ca55297aeac1893e2ba1a156f5895734efbb40c94eb` |
| `fonts/Assets/aafonts/romulan10.bft` | 28221 | `e1e644c128db1cd25ecda17aea250a3fcf4a53a24466a4ed623dd452715cca72` |
| `fonts/Assets/aafonts/romulan11.bft` | 33047 | `a441528bb3d7e365768255051fc1f7345d7447d41206f7bab86256dfc8faffac` |
| `fonts/Assets/aafonts/romulan12.bft` | 38061 | `c5bdbebd1ac3c19e6ef98c8f44e20a8b421f3b8c451e9965f6f6e40cd2127d8a` |
| `fonts/Assets/aafonts/romulan14.bft` | 48300 | `b817d872361b871e276eddeaa6d8573a8ab473775596814c1f2e53f9851e66a9` |
| `fonts/Assets/aafonts/romulan16.bft` | 60085 | `1fa1bd2cdb93b0f46db65edf7b51fdad53275567bc44d39e38ab88e42afd5ab5` |
| `fonts/Assets/aafonts/romulan18.bft` | 74527 | `73b6f3e70782f8393e220a6a9eca1ba90ec342cd966020a96dd44b690ba2c0ca` |
| `fonts/Assets/aafonts/romulan20.bft` | 88133 | `20505e429db5b8d00b9551c6aa17233b902ef26a55e8808574c5608bb98987fa` |
| `fonts/Assets/aafonts/romulan22.bft` | 104321 | `464ea6b42aa713d1276d85527ec6ce80eb95d2436054d8ac8bcb735603bc629f` |
| `fonts/Assets/aafonts/romulan24.bft` | 122416 | `ccb2e008d881e9bff17549cf58e62c5f70691cd846b3da868a04638a441820bb` |
| `fonts/Assets/aafonts/romulan5.bft` | 11755 | `02ef07537663e92114f85c6814d62d0b24bcce3a29690f6bdda4a81cc373bd54` |
| `fonts/Assets/aafonts/romulan6.bft` | 14501 | `ef967eb96267323c8b29a66d4a4271765e8caeaf11808b0b04d66f38003be30b` |
| `fonts/Assets/aafonts/romulan7.bft` | 16825 | `a1f909571340c8159d33becab526b1817c78f927a98e90a767fff3af40303c64` |
| `fonts/Assets/aafonts/romulan8.bft` | 19915 | `bb3a193acf4fb6ef36cc29787eefbbae03b68f0708ad3b6b63bce9add259091d` |
| `fonts/Assets/aafonts/romulan9.bft` | 25172 | `0c76491ec1ec21861d2b6616e47546cdb2807bd9f3510984c44f5d05e73812bd` |

## Extensionless files (weapon-group table candidates)

- Count: 166 (text=166, binary=0)
- Common directory: `tables/weapon_groups/Assets/WeaponGroups`
- File-name pattern: mixed{3-6} (166 names)
- Sizes: min=70 max=148 total=18202 mean=110
- Headers shared across tables: None

- No column-header row was identified in these files (none invented).

Column-count layouts (including files with no header):

| Header? | Delimiter | Columns | Data cols min | Data cols max | Files |
| --- | --- | ---: | ---: | ---: | ---: |
| False | `unknown` | 1 | 1 | 1 | 166 |

## `.gf` structure

- Count: 28 (text=28, binary=0)
- Coordinates: not determinable

| Path | Size | Kind | Magic (hex) | Headers | Coords parseable |
| --- | ---: | --- | --- | --- | --- |
| `settings/Assets/CommonSettings/Chat.gf` | 660 | text | `4e616d65203d202243686174220d0a0d` |  | False |
| `settings/Assets/CommonSettings/german/RaceNames.gf` | 608 | text | `4e616d65203d2022526163654e616d65` |  | False |
| `settings/Assets/CommonSettings/RaceNames.gf` | 571 | text | `4e616d65203d2022526163654e616d65` |  | False |
| `settings/Assets/CommonSettings/ShipNames.gf` | 6437 | text | `4e616d65203d2022536869704e616d65` |  | False |
| `settings/ClientSettings.gf` | 44 | text | `50726f66696c657350617468203d2022` |  | False |
| `settings/CommonSettings.gf` | 40 | text | `50726f66696c657350617468203d2022` |  | False |
| `settings/MetaAssets/ClientSettings/GameSpy.gf` | 44 | text | `4e616d653d2247616d65537079220d0a` |  | False |
| `settings/MetaAssets/ClientSettings/german/Help.gf` | 10642 | text | `4e616d65203d202248656c70220d0a0d` |  | False |
| `settings/MetaAssets/ClientSettings/Help.gf` | 9397 | text | `4e616d65203d202248656c70220d0a0d` |  | False |
| `settings/MetaAssets/ServerProfiles/Debug.gf` | 470 | text | `4e616d653d224465627567220d0a0d0a` |  | False |
| `settings/MetaAssets/ServerProfiles/Multiplayer/GameSpy.gf` | 188 | text | `4e616d653d2247616d65537079220d0a` |  | False |
| `settings/MetaAssets/ServerProfiles/Multiplayer/WONServerSetup.gf` | 712 | text | `4e616d653d2253657276657253657475` |  | False |
| `settings/MetaAssets/ServerProfiles/Singleplayer/Assets.gf` | 263 | text | `4e616d65203d2022417373657473220d` |  | False |
| `settings/MetaAssets/ServerProfiles/Singleplayer/Character.gf` | 3052 | text | `4e616d65203d20224368617261637465` | Name = "Character",  | False |
| `settings/MetaAssets/ServerProfiles/Singleplayer/Database.gf` | 273 | text | `4e616d653d2022446174616261736522` |  | False |
| `settings/MetaAssets/ServerProfiles/Singleplayer/Economy.gf` | 2856 | text | `2f2f5468697320697320776865726520` |  | False |
| `settings/MetaAssets/ServerProfiles/Singleplayer/german/Language.gf` | 44 | text | `4e616d65203d20224c616e6775616765` |  | False |
| `settings/MetaAssets/ServerProfiles/Singleplayer/german/MetaMap.gf` | 6408 | text | `4e616d653d224d6574614d6170220d0a` |  | False |
| `settings/MetaAssets/ServerProfiles/Singleplayer/HexValues.gf` | 493 | text | `4e616d653d2248657856616c75657322` |  | False |
| `settings/MetaAssets/ServerProfiles/Singleplayer/Language.gf` | 44 | text | `4e616d65203d20224c616e6775616765` |  | False |
| `settings/MetaAssets/ServerProfiles/Singleplayer/MetaMap.gf` | 6671 | text | `4e616d653d224d6574614d6170220d0a` |  | False |
| `settings/MetaAssets/ServerProfiles/Singleplayer/MissionMatching.gf` | 4189 | text | `4e616d653d224d697373696f6e4d6174` |  | False |
| `settings/MetaAssets/ServerProfiles/Singleplayer/News.gf` | 1657 | text | `4e616d65203d20224e65777322202f2f` |  | False |
| `settings/MetaAssets/ServerProfiles/Singleplayer/Score.gf` | 2351 | text | `4e616d653d2253636f7265220d0a0d0a` |  | False |
| `settings/MetaAssets/ServerProfiles/Singleplayer/Ship.gf` | 515 | text | `4e616d653d2253686970220d0a0d0a5b` |  | False |
| `settings/MetaAssets/ServerProfiles/Singleplayer/SinglePlayerServerSetup.gf` | 758 | text | `4e616d653d2253657276657253657475` |  | False |
| `settings/MetaAssets/ServerProfiles/Singleplayer/Time.gf` | 248 | text | `4e616d65203d202254696d65220d0a0d` |  | False |
| `settings/ServerSettings.gf` | 58 | text | `50726f66696c657350617468203d2022` |  | False |

## `.mct` structure

- Count: 28 (text=28, binary=0)
- Coordinates: not determinable

| Path | Size | Kind | Magic (hex) | Headers | Coords parseable |
| --- | ---: | --- | --- | --- | --- |
| `scripts/Assets/Scripts/Campaigns/ConquestBonus/Conquest Fed .mct` | 814 | text | `4e616d653d22436f6e71756573742046` |  | False |
| `scripts/Assets/Scripts/Campaigns/ConquestBonus/Conquest Gorn .mct` | 814 | text | `4e616d653d22436f6e71756573742047` |  | False |
| `scripts/Assets/Scripts/Campaigns/ConquestBonus/Conquest Hydran .mct` | 816 | text | `4e616d653d22436f6e71756573742048` |  | False |
| `scripts/Assets/Scripts/Campaigns/ConquestBonus/Conquest ISC .mct` | 813 | text | `4e616d653d22436f6e71756573742049` |  | False |
| `scripts/Assets/Scripts/Campaigns/ConquestBonus/Conquest Klingon .mct` | 817 | text | `4e616d653d22436f6e7175657374204b` |  | False |
| `scripts/Assets/Scripts/Campaigns/ConquestBonus/Conquest Lyran .mct` | 815 | text | `4e616d653d22436f6e7175657374204c` |  | False |
| `scripts/Assets/Scripts/Campaigns/ConquestBonus/Conquest Mirak .mct` | 815 | text | `4e616d653d22436f6e7175657374204d` |  | False |
| `scripts/Assets/Scripts/Campaigns/ConquestBonus/Conquest Rom .mct` | 817 | text | `4e616d653d22436f6e71756573742052` |  | False |
| `scripts/Assets/Scripts/Campaigns/custommissions/Custom-Federation.mct` | 826 | text | `4e616d653d2246656420657874726122` |  | False |
| `scripts/Assets/Scripts/Campaigns/custommissions/Custom-Gorn.mct` | 819 | text | `4e616d653d22476f726e206578747261` |  | False |
| `scripts/Assets/Scripts/Campaigns/custommissions/Custom-Hydran.mct` | 825 | text | `4e616d653d2248796472616e20657874` |  | False |
| `scripts/Assets/Scripts/Campaigns/custommissions/Custom-ISC.mct` | 814 | text | `4e616d653d2249534320657874726122` |  | False |
| `scripts/Assets/Scripts/Campaigns/custommissions/Custom-Klingon.mct` | 835 | text | `4e616d653d224b6c696e676f6e206578` |  | False |
| `scripts/Assets/Scripts/Campaigns/custommissions/Custom-Lyran.mct` | 824 | text | `4e616d653d224c7972616e2065787472` |  | False |
| `scripts/Assets/Scripts/Campaigns/custommissions/Custom-Mirak.mct` | 821 | text | `4e616d653d224d6972616b2065787472` |  | False |
| `scripts/Assets/Scripts/Campaigns/custommissions/Custom-Romulan.mct` | 837 | text | `4e616d653d22526f6d756c616e206578` |  | False |
| `scripts/Assets/Scripts/Campaigns/ISC-Fed.mct` | 1366 | text | `4e616d653d2246656465726174696f6e` |  | False |
| `scripts/Assets/Scripts/Campaigns/ISC-Gorn.mct` | 1379 | text | `4e616d653d22476f726e207673207468` |  | False |
| `scripts/Assets/Scripts/Campaigns/ISC-Hydran.mct` | 1288 | text | `4e616d653d2248796472616e20767320` |  | False |
| `scripts/Assets/Scripts/Campaigns/ISC-ISC.mct` | 1228 | text | `4e616d653d2249534320576172206f66` |  | False |
| `scripts/Assets/Scripts/Campaigns/ISC-Klingon.mct` | 1274 | text | `4e616d653d224b6c696e676f6e207673` |  | False |
| `scripts/Assets/Scripts/Campaigns/ISC-Lyran.mct` | 1306 | text | `4e616d653d224c7972616e2076732074` |  | False |
| `scripts/Assets/Scripts/Campaigns/ISC-Mirak.mct` | 1305 | text | `4e616d653d224d6972616b2076732074` |  | False |
| `scripts/Assets/Scripts/Campaigns/ISC-Romulan.mct` | 1347 | text | `4e616d653d22526f6d756c616e207673` |  | False |
| `scripts/Assets/Scripts/Campaigns/Mirak - Hydran.mct` | 1192 | text | `4e616d653d2248796472616e20767320` |  | False |
| `scripts/Assets/Scripts/Campaigns/Mirak - Klingon.mct` | 1194 | text | `4e616d653d224b6c696e676f6e207673` |  | False |
| `scripts/Assets/Scripts/Campaigns/Mirak - Lyran.mct` | 1173 | text | `4e616d653d224c7972616e207673204d` |  | False |
| `scripts/Assets/Scripts/Campaigns/Mirak - Mirak.mct` | 1162 | text | `4e616d653d224d6972616b2043616d70` |  | False |


