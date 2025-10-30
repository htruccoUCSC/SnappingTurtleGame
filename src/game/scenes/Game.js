import { Scene } from 'phaser';

export class Game extends Scene
{
    constructor ()
    {
        super('Game');
    }

    create ()
    {
        this.cameras.main.setBackgroundColor(0x00ff00);
        // center coords
        this.centerX = this.cameras.main.width / 2;
        this.centerY = this.cameras.main.height / 2;

        // Score & UI
        this.score = 0;
        this.scoreText = this.add.text(16, 16, 'Score: 0', { fontFamily: 'Arial', fontSize: 24, color: '#ffffff' }).setDepth(10);

        // Mouth sprites (open by default)
        this.mouthX = this.centerX;
        this.mouthY = this.centerY;

        this.mouthOpen = this.add.image(this.mouthX, this.mouthY, 'turtle-mouth-open').setOrigin(0.5).setDepth(2);
        this.mouthClosed = this.add.image(this.mouthX, this.mouthY, 'turtle-mouth-closed').setOrigin(0.5).setDepth(3).setVisible(false);

        // Hand - start off-screen to the right. Use origin (1,0.5) so scaleX reduces from the right edge inward.
    this.handY = this.mouthY + Math.round(this.mouthOpen.displayHeight * 0.18) - 90;
    this.handOffscreenX = this.cameras.main.width + 200;
    // target insertion x will be computed after we know hand scale; default placeholder
    this.handInX = this.mouthX + Math.round(this.mouthOpen.displayWidth * 0.45);

    this.spawnHand();

    // Input handling
    this.isMouthClosed = false;
    this.lastBiteTime = 0;
    this.isBiting = false;

        this.input.keyboard.on('keydown-SPACE', () => {
            this.closeMouth();
        });

        this.input.keyboard.on('keyup-SPACE', () => {
            this.openMouth();
        });
    }

    // Create a new hand and animate it moving into the mouth
    spawnHand () {
        // remove existing hand if present
        if (this.hand) {
            this.hand.destroy();
        }

    this.hand = this.add.image(this.handOffscreenX, this.handY, 'hand').setOrigin(1, 0.5).setDepth(1);
    this.handRemaining = 1.0; // fraction of hand left

    // Compute a display scale so the (very large) phone photo fits visually when inserted.
    // Make the phone photo hand much smaller so it looks right next to the turtle (was 1696px wide)
    const desiredHandDisplayWidth = 424; // px when handRemaining == 1 (tweakable)
    const textureHandWidth = this.hand.width;
    const desiredHandDispalyHeight = 76;
    const textureHandHeight = this.hand.height;
    this.hand.setScale(desiredHandDisplayWidth/textureHandWidth, desiredHandDispalyHeight/textureHandHeight);

    // Recompute insertion X based on mouth/display sizes
    this.handInX = this.mouthX + Math.round(this.mouthOpen.displayWidth * 0.45);

        // Choose a random maximum insertion depth at spawn time: 33% - 100% of the way from offscreen -> full-in
        const fullInX = this.mouthX + Math.round(this.mouthOpen.displayWidth * 0.45);
        const startX = this.handOffscreenX;
        const depthPercent = Phaser.Math.FloatBetween(0.33, 1.0);
        // handInX is a point moved `depthPercent` of the distance from startX to fullInX
        this.handInX = Math.round(startX - depthPercent * (startX - fullInX));

        // Move in a lot slower so the hand lingers during approach
        const approachDur = Phaser.Math.Between(2200, 4000);

        // move hand into the selected target (may be shallow)
        this.tweens.add({
            targets: this.hand,
            x: this.handInX,
            duration: approachDur,
            ease: 'Linear',
            onComplete: () => {
                // Immediately pull out quickly (no hanging out)
                const fastOutDur = Phaser.Math.Between(200, 450);
                this.handWithdraw(fastOutDur);
            }
        });
    }

    scheduleRandomExit () {
        // Cancel any existing exit event
        if (this.exitEvent) {
            this.exitEvent.remove(false);
        }

        // Randomly schedule a withdrawal between 1 and 4 seconds
        const delay = Phaser.Math.Between(1000, 4000);
        this.exitEvent = this.time.addEvent({ delay, callback: this.handWithdraw, callbackScope: this });
    }

    handWithdraw (duration) {
        // duration may be passed; if Phaser passes a TimerEvent as first arg, detect and ignore it
        if (typeof duration === 'object') { duration = undefined; }
        const outDur = duration || 700;

        // Animate hand moving back off-screen and end the game when done
        if (!this.hand) { return; }
        // mark that a withdraw attempt is happening
        this.hand._exiting = true;

        this.tweens.add({
            targets: this.hand,
            x: this.handOffscreenX,
            duration: outDur,
            ease: 'Cubic.easeIn',
            onComplete: () => {
                // If a bite is currently being processed, don't treat this as an escape.
                if (this.isBiting) { return; }
                // Hand withdrew before a bite: score is 0
                this.score = 0;
                this.scene.start('GameOver', { score: this.score });
            }
        });
    }

    closeMouth () {
        if (this.isMouthClosed || this.isBiting) { return; }
        this.isMouthClosed = true;
        this.mouthOpen.setVisible(false);
        this.mouthClosed.setVisible(true);

        // Single bite: compute how much of the hand is inside the mouth right now.
        // If the player bites before the hand reaches the mouth, that's a score of 0.
        let biteScore = 0;
        if (!this.hand) {
            biteScore = 0;
        } else {
            const mouthBounds = this.mouthClosed.getBounds();
            const handBounds = this.hand.getBounds();
            const intersection = Phaser.Geom.Intersects.GetRectangleIntersection(mouthBounds, handBounds);
            if (intersection && intersection.width > 0) {
                const fraction = Phaser.Math.Clamp(intersection.width / handBounds.width, 0, 1);
                biteScore = Math.round(fraction * 100); // score as percent of hand bitten
            } else {
                biteScore = 0; // bit too early / missed
            }
        }

        this.score = biteScore;

        // Prevent the hand from withdrawing and stop its movement while we're in the bite state
        if (this.exitEvent) { this.exitEvent.remove(false); }
        if (this.hand) {
            this.hand._exiting = true;
            // stop any tweens moving the hand so it freezes in place
            this.tweens.killTweensOf(this.hand);
        }
        this.isBiting = true;

        // Update score text so player sees the result before transition
        this.scoreText.setText('Score: ' + this.score);

        // Delay transition so the bite animation can breathe
        this.time.delayedCall(700, () => {
            this.scene.start('GameOver', { score: this.score });
        });
    }

    openMouth () {
        // Ignore open requests while biting is in progress
        if (!this.isMouthClosed || this.isBiting) { return; }
        this.isMouthClosed = false;
        this.mouthOpen.setVisible(true);
        this.mouthClosed.setVisible(false);
    }
}
