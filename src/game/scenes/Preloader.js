import { Scene } from 'phaser';

export class Preloader extends Scene
{
    constructor ()
    {
        super('Preloader');
    }

    init ()
    {
        //  We loaded this image in our Boot Scene, so we can display it here
        // this.add.image(512, 384, 'background');

        //  A simple progress bar. This is the outline of the bar.
        this.add.rectangle(512, 384, 468, 32).setStrokeStyle(1, 0xffffff);

        //  This is the progress bar itself. It will increase in size from the left based on the % of progress.
        const bar = this.add.rectangle(512-230, 384, 4, 28, 0xffffff);

        //  Use the 'progress' event emitted by the LoaderPlugin to update the loading bar
        this.load.on('progress', (progress) => {

            //  Update the progress bar (our bar is 464px wide, so 100% = 464px)
            bar.width = 4 + (460 * progress);

        });
    }

    preload ()
    {
        //  Load the assets for the game - Replace with your own assets
        this.load.setPath('assets');
        this.load.image('turtle-mouth-open', 'TurtleMouthOpen.png');
        this.load.image('turtle-mouth-closed', 'TurtleMouthClosed.png');
        this.load.image('hand', 'Hand.png');
        this.load.spritesheet('turtle', 'TurtleSpriteSheet.png', {
            frameWidth: 64,
            frameHeight: 32
        });

        this.load.audio('bite', 'carrotnom-92106.mp3');
        this.load.audio('miss', 'PufferfishBite.mp3');
    }

    create ()
    {
        //  When all the assets have loaded, it's often worth creating global objects here that the rest of the game can use.
        //  For example, you can define global animations here, so we can use them in other scenes.
        this.textures.get('turtle').setFilter(Phaser.Textures.FilterMode.NEAREST);

        this.anims.create({
            key: 'turtle-idle',
            frameRate: 0,
            repeat: -1,
            frames: this.anims.generateFrameNumbers('turtle', {
                frames: [0]
            })
        })

        this.anims.create({
            key: 'turtle-attack',
            frameRate: 0,
            repeat: 0,
            frames: this.anims.generateFrameNumbers('turtle', {
                frames: [1]
            })
        })

        this.anims.create({
            key: 'turtle-miss',
            frameRate: 0,
            repeat: 0,
            frames: this.anims.generateFrameNumbers('turtle', {
                frames: [1]
            })
        })

        this.anims.create({
            key: 'turtle-victory',
            frameRate: 0,
            repeat: -1,
            frames: this.anims.generateFrameNumbers('turtle', {
                frames: [3]
            })
        })

        this.anims.create({
            key: 'turtle-defeat',
            frameRate: 0,
            repeat: -1,
            frames: this.anims.generateFrameNumbers('turtle', {
                frames: [4]
            })
        })

        //  Move to the Game. You could also swap this for a Scene Transition, such as a camera fade.
        this.scene.start('Game');
    }
}
