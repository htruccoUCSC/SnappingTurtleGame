import { Scene } from 'phaser';

export class GameOver extends Scene
{
    constructor ()
    {
        super('GameOver');
    }

    create ()
    {
        this.cameras.main.setBackgroundColor(0x7FFF00);

        // this.add.image(512, 384, 'background').setAlpha(0.5);

        this.add.text(512, 320, 'Congratulations!', {
            fontFamily: 'Arial Black', fontSize: 64, color: '#ffffff',
            stroke: '#000000', strokeThickness: 8,
            align: 'center'
        }).setOrigin(0.5);

        // Show final score if provided
        const score = (this.scene.settings && this.scene.settings.data && this.scene.settings.data.score) ? this.scene.settings.data.score : 0;

        this.add.text(512, 420, 'Score: ' + score, {
            fontFamily: 'Arial', fontSize: 36, color: '#ffffff',
            stroke: '#000000', strokeThickness: 6,
            align: 'center'
        }).setOrigin(0.5);

        this.add.text(512, 520, 'Click to return to Main Menu', {
            fontFamily: 'Arial', fontSize: 20, color: '#ffffff',
            stroke: '#000000', strokeThickness: 4,
            align: 'center'
        }).setOrigin(0.5);

        this.input.once('pointerdown', () => {
            this.scene.start('MainMenu');
        });
    }
}
